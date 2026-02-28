import { randomUUID } from "node:crypto";
import {
    AudioEncoding,
    RealtimeTranscription,
} from "@mistralai/mistralai/extra/realtime";
import type {
    StartMistralRealtimeTranscriptionPayload,
    VoiceTranscriptionEvent,
} from "../../../src/types/ElectronApi";

type SessionState = {
    id: string;
    queue: Uint8Array[];
    waiters: Array<() => void>;
    ended: boolean;
    runPromise: Promise<void>;
};

const normalizeChunk = (chunk: unknown): Uint8Array => {
    if (chunk instanceof Uint8Array) {
        return chunk;
    }

    if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk);
    }

    if (Array.isArray(chunk)) {
        return new Uint8Array(chunk);
    }

    throw new Error("Invalid audio chunk format");
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Realtime transcription failed";
};

export class MistralService {
    private readonly sessions = new Map<string, SessionState>();

    constructor(
        private readonly emitEvent: (event: VoiceTranscriptionEvent) => void,
    ) {}

    async startSession(
        payload: StartMistralRealtimeTranscriptionPayload,
    ): Promise<{ sessionId: string }> {
        const apiKey = payload.apiKey.trim();

        if (!apiKey) {
            throw new Error("Mistral API key is required");
        }

        const model = payload.model.trim();

        if (!model) {
            throw new Error("Mistral model is required");
        }

        const sampleRate = Number(payload.sampleRate) || 16000;
        const sessionId = randomUUID();

        const session: SessionState = {
            id: sessionId,
            queue: [],
            waiters: [],
            ended: false,
            runPromise: Promise.resolve(),
        };

        const audioStream = this.createAudioStream(session);
        const client = new RealtimeTranscription({ apiKey });

        session.runPromise = this.consumeTranscriptionStream(
            sessionId,
            client,
            audioStream,
            model,
            sampleRate,
        )
            .catch((error) => {
                this.emitEvent({
                    sessionId,
                    type: "error",
                    message: toErrorMessage(error),
                });
            })
            .finally(async () => {
                await audioStream.return?.();
                this.cleanupSession(sessionId);
            });

        this.sessions.set(sessionId, session);

        return { sessionId };
    }

    async pushChunk(sessionId: string, chunk: unknown): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session || session.ended) {
            return;
        }

        session.queue.push(normalizeChunk(chunk));
        this.notifyWaiters(session);
    }

    async stopSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return;
        }

        session.ended = true;
        this.notifyWaiters(session);
        await session.runPromise;
    }

    async stopAll(): Promise<void> {
        const ids = Array.from(this.sessions.keys());

        for (const id of ids) {
            await this.stopSession(id);
        }
    }

    private createAudioStream(
        session: SessionState,
    ): AsyncGenerator<Uint8Array, void, unknown> {
        const waitForChunk = () =>
            new Promise<void>((resolve) => {
                session.waiters.push(resolve);
            });

        return (async function* stream() {
            while (true) {
                if (session.queue.length > 0) {
                    const chunk = session.queue.shift();

                    if (chunk) {
                        yield chunk;
                        continue;
                    }
                }

                if (session.ended) {
                    break;
                }

                await waitForChunk();
            }
        })();
    }

    private async consumeTranscriptionStream(
        sessionId: string,
        client: RealtimeTranscription,
        audioStream: AsyncGenerator<Uint8Array, void, unknown>,
        model: string,
        sampleRate: number,
    ): Promise<void> {
        for await (const event of client.transcribeStream(audioStream, model, {
            audioFormat: {
                encoding: AudioEncoding.PcmS16le,
                sampleRate,
            },
        })) {
            if (
                event.type === "transcription.text.delta" &&
                "text" in event &&
                typeof event.text === "string"
            ) {
                this.emitEvent({
                    sessionId,
                    type: "transcription.text.delta",
                    text: event.text,
                });
                continue;
            }

            if (event.type === "transcription.done") {
                this.emitEvent({
                    sessionId,
                    type: "transcription.done",
                });
                break;
            }

            if (event.type === "error") {
                const error = "error" in event ? event.error : undefined;
                const message =
                    typeof error?.message === "string"
                        ? error.message
                        : JSON.stringify(error?.message);

                this.emitEvent({
                    sessionId,
                    type: "error",
                    message: message || "Realtime transcription error",
                });
                break;
            }
        }
    }

    private notifyWaiters(session: SessionState): void {
        while (session.waiters.length > 0) {
            const resolve = session.waiters.shift();
            resolve?.();
        }
    }

    private cleanupSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return;
        }

        session.ended = true;
        this.notifyWaiters(session);
        this.sessions.delete(sessionId);
    }
}
