import type { OllamaService } from "../services/agents/OllamaService";
import type { MistralService } from "../services/agents/MistralService";
import type { PiperService } from "../services/agents/PiperService";
import type { UserProfileService } from "../services/userData/UserProfileService";
import type {
    ProxyHttpRequestPayload,
    StartMistralRealtimeTranscriptionPayload,
    StreamOllamaChatPayload,
} from "../../src/types/ElectronApi";
import { handleIpc, handleManyIpc } from "./ipcUtils";

export type IpcAgentsPackDeps = {
    ollamaService: OllamaService;
    mistralService: MistralService;
    piperService: PiperService;
    userProfileService: UserProfileService;
};

export const registerIpcAgentsPack = ({
    ollamaService,
    mistralService,
    piperService,
    userProfileService,
}: IpcAgentsPackDeps) => {
    handleIpc(
        "app:ollama-stream-chat",
        async (payload: StreamOllamaChatPayload) => {
            const token = userProfileService.getUserProfile().ollamaToken;

            return ollamaService.streamChat(payload, token);
        },
    );

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
