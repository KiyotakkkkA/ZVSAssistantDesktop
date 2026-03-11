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
        let queueHead = 0;
        let notify: (() => void) | null = null;

        const pushQueueItem = (item: QueueItem) => {
            queue.push(item);

            if (queueHead > 1024 && queueHead * 2 >= queue.length) {
                queue.splice(0, queueHead);
                queueHead = 0;
            }
        };

        const shiftQueueItem = (): QueueItem | undefined => {
            if (queueHead >= queue.length) {
                return undefined;
            }

            const item = queue[queueHead];
            queueHead += 1;
            return item;
        };

        const wake = () => {
            if (notify) {
                const fn = notify;
                notify = null;
                fn();
            }
        };

        const streamPromise = this.addon
            .streamChat(
                payloadJson,
                token,
                Config.OLLAMA_BASE_URL.trim(),
                (err: null | Error, chunkJson: string) => {
                    if (err) {
                        pushQueueItem({ kind: "error", error: err });
                    } else {
                        try {
                            pushQueueItem({
                                kind: "chunk",
                                chunk: JSON.parse(chunkJson) as OllamaChatChunk,
                            });
                        } catch (parseErr) {
                            pushQueueItem({
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
                pushQueueItem({ kind: "done" });
                wake();
            })
            .catch((err: unknown) => {
                pushQueueItem({
                    kind: "error",
                    error: err instanceof Error ? err : new Error(String(err)),
                });
                pushQueueItem({ kind: "done" });
                wake();
            });

        try {
            while (true) {
                while (queueHead >= queue.length) {
                    await new Promise<void>((resolve) => {
                        notify = resolve;
                    });
                }

                const item = shiftQueueItem()!;
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
