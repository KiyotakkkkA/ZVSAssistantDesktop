import { Config } from "../../../src/config";
import type { OllamaChatChunk } from "../../../src/types/Chat";
import type { StreamOllamaChatPayload } from "../../../src/types/ElectronApi";
import { getNativeCoreAddon } from "../core/nativeCoreAddon";

type GetEmbedPayload = {
    model: string;
    input: string | string[];
};

export class OllamaService {
    private readonly addon = getNativeCoreAddon();

    constructor() {}

    async *streamChat(
        payload: StreamOllamaChatPayload,
        token: string,
    ): AsyncGenerator<OllamaChatChunk> {
        const payloadJson = JSON.stringify({
            model: payload.model,
            messages: payload.messages,
            ...(payload.tools ? { tools: payload.tools } : {}),
            ...(payload.format ? { format: payload.format } : {}),
            ...(payload.think !== undefined ? { think: payload.think } : {}),
        });

        type QueueItem =
            | { kind: "chunk"; chunk: OllamaChatChunk }
            | { kind: "error"; error: Error }
            | { kind: "done" };

        const queue: QueueItem[] = [];
        let notify: (() => void) | null = null;

        const wake = () => {
            if (notify) {
                const fn = notify;
                notify = null;
                fn();
            }
        };

        const streamPromise = this.addon
            .streamChatCallback(
                payloadJson,
                token,
                Config.OLLAMA_BASE_URL.trim(),
                (err: null | Error, chunkJson: string) => {
                    if (err) {
                        queue.push({ kind: "error", error: err });
                    } else {
                        try {
                            queue.push({
                                kind: "chunk",
                                chunk: JSON.parse(chunkJson) as OllamaChatChunk,
                            });
                        } catch (parseErr) {
                            queue.push({
                                kind: "error",
                                error:
                                    parseErr instanceof Error
                                        ? parseErr
                                        : new Error(String(parseErr)),
                            });
                        }
                    }
                    wake();
                },
            )
            .then(() => {
                queue.push({ kind: "done" });
                wake();
            })
            .catch((err: unknown) => {
                queue.push({
                    kind: "error",
                    error: err instanceof Error ? err : new Error(String(err)),
                });
                queue.push({ kind: "done" });
                wake();
            });

        try {
            while (true) {
                while (queue.length === 0) {
                    await new Promise<void>((resolve) => {
                        notify = resolve;
                    });
                }

                const item = queue.shift()!;
                if (item.kind === "done") break;
                if (item.kind === "error") throw item.error;
                yield item.chunk;
            }
        } finally {
            await streamPromise;
        }
    }

    async getEmbed(payload: GetEmbedPayload, token: string) {
        const payloadJson = JSON.stringify(payload);
        const responseJson = await this.addon.getEmbed(
            payloadJson,
            token,
            Config.OLLAMA_BASE_URL.trim(),
        );

        const parsed = JSON.parse(responseJson) as {
            model?: string;
            embeddings?: unknown;
            total_duration?: number;
            load_duration?: number;
            prompt_eval_count?: number;
        };

        const embeddingsSource = Array.isArray(parsed.embeddings)
            ? parsed.embeddings
            : [];
        const embeddings = embeddingsSource.map((vector) =>
            Array.isArray(vector)
                ? vector.map((value) => Number(value))
                : ([] as number[]),
        );

        return {
            model: parsed.model,
            embeddings,
            ...(typeof parsed.total_duration === "number"
                ? { total_duration: parsed.total_duration }
                : {}),
            ...(typeof parsed.load_duration === "number"
                ? { load_duration: parsed.load_duration }
                : {}),
            ...(typeof parsed.prompt_eval_count === "number"
                ? { prompt_eval_count: parsed.prompt_eval_count }
                : {}),
        };
    }
}
