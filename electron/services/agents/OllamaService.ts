import { Config } from "../../../src/config";
import type { OllamaChatChunk } from "../../../src/types/Chat";
import type { StreamOllamaChatPayload } from "../../../src/types/ElectronApi";
import {
    buildVectorStorageSearchUrl,
    normalizeVectorSearchResponse,
    type VectorSearchPayload,
} from "../../../src/services/api/vectorSearchShared";
import { getNativeCoreAddon } from "../core/nativeCoreAddon";

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

    async getEmbed(
        vstore_id: string,
        payload: VectorSearchPayload,
        token: string,
    ) {
        const response = await fetch(
            buildVectorStorageSearchUrl(Config.ZVS_MAIN_BASE_URL, vstore_id),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token
                        ? {
                              Authorization: `Bearer ${token}`,
                          }
                        : {}),
                },
                body: JSON.stringify(payload),
            },
        );

        const raw = await response.text();

        if (!response.ok) {
            throw new Error(
                raw || `Request failed with status ${response.status}`,
            );
        }

        const parsed = normalizeVectorSearchResponse(raw);

        return {
            success: parsed.success ?? true,
            message: parsed.message,
            items: parsed.items ?? [],
        };
    }
}
