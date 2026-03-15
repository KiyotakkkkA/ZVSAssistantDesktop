import type { MistralService } from "../services/agents/MistralService";
import type { PiperService } from "../services/agents/PiperService";
import type { ChatSessionService } from "../services/chat/ChatSessionService";
import type {
    ProxyHttpRequestPayload,
    ResolveCommandApprovalPayload,
    StartMistralRealtimeTranscriptionPayload,
    RunChatSessionPayload,
} from "../../src/types/ElectronApi";
import { handleIpc, handleIpcWithEvent, handleManyIpc } from "./ipcUtils";

const parseJson = <T>(raw: string): T => JSON.parse(raw) as T;
const toJson = (value: unknown): string => JSON.stringify(value);

export type IpcAgentsPackDeps = {
    chatSessionService: ChatSessionService;
    mistralService: MistralService;
    piperService: PiperService;
};

export const registerIpcAgentsPack = ({
    chatSessionService,
    mistralService,
    piperService,
}: IpcAgentsPackDeps) => {
    handleIpcWithEvent(
        "app:chat-run-session",
        async (event, payloadRaw: string) => {
            const payload = parseJson<RunChatSessionPayload>(payloadRaw);

            await chatSessionService.runSession(payload, (chatEvent) => {
                event.sender.send("app:chat-session-event", toJson(chatEvent));
            });
        },
    );

    handleIpc("app:chat-cancel-session", async (sessionId: string) => {
        return chatSessionService.cancelSession(sessionId);
    });

    handleIpc(
        "app:chat-resolve-command-approval",
        async (payloadRaw: string) => {
            return chatSessionService.resolveCommandApproval(
                parseJson<ResolveCommandApprovalPayload>(payloadRaw),
            );
        },
    );

    handleIpc("app:chat-interrupt-command-exec", async (callId: string) => {
        return chatSessionService.interruptCommandExec(callId);
    });

    handleIpc(
        "app:proxy-http-request",
        async (payload: ProxyHttpRequestPayload) => {
            const url =
                typeof payload?.url === "string" ? payload.url.trim() : "";
            const method =
                typeof payload?.method === "string"
                    ? payload.method.trim().toUpperCase()
                    : "GET";
            const headers =
                payload && typeof payload.headers === "object"
                    ? payload.headers
                    : undefined;
            const requestBodyText =
                typeof payload?.bodyText === "string"
                    ? payload.bodyText
                    : undefined;

            if (!url) {
                return {
                    ok: false,
                    status: 0,
                    statusText: "URL is required",
                    bodyText: "",
                };
            }

            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        Accept: "application/json, text/plain, */*",
                        ...(headers || {}),
                    },
                    ...(requestBodyText && method !== "GET" && method !== "HEAD"
                        ? { body: requestBodyText }
                        : {}),
                });
                const responseBodyText = await response.text();

                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    bodyText: responseBodyText,
                };
            } catch (error) {
                return {
                    ok: false,
                    status: 0,
                    statusText:
                        error instanceof Error
                            ? error.message
                            : "Network request failed",
                    bodyText: "",
                };
            }
        },
    );

    handleManyIpc([
        [
            "app:voice-transcription-start",
            (payload: StartMistralRealtimeTranscriptionPayload) =>
                mistralService.startSession(payload),
        ],
        [
            "app:voice-transcription-push-chunk",
            async (sessionId: string, chunk: Uint8Array) => {
                await mistralService.pushChunk(sessionId, chunk);
            },
        ],
        [
            "app:voice-transcription-stop",
            async (sessionId: string) => {
                await mistralService.stopSession(sessionId);
            },
        ],
        [
            "app:voice-synthesize-with-piper",
            (text: string) => piperService.synthesize(text),
        ],
    ]);
};
