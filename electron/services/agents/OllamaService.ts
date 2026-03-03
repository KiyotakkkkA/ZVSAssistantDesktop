import { Ollama, type ChatRequest } from "ollama";
import { Config } from "../../../src/config";
import type { OllamaChatChunk, OllamaRole } from "../../../src/types/Chat";
import type { StreamOllamaChatPayload } from "../../../src/types/ElectronApi";
import { attempt } from "../../errors/errorPattern";

type GetEmbedPayload = {
    model: string;
    input: string | string[];
};

const LOCAL_OLLAMA_HOST = "http://127.0.0.1:11434";

export class OllamaService {
    private cachedHost = "";
    private cachedAuthHeader = "";
    private cachedClient: Ollama | null = null;

    private getClient(
        host: string,
        token: string,
        mode: "bearer" | "raw" | "none",
    ): Ollama {
        const normalizedToken = token.trim();
        const authorizationHeader = this.toAuthorizationHeader(
            normalizedToken,
            mode,
        );
        const authCacheKey = authorizationHeader || "";

        if (
            this.cachedClient &&
            this.cachedHost === host &&
            this.cachedAuthHeader === authCacheKey
        ) {
            return this.cachedClient;
        }

        this.cachedHost = host;
        this.cachedAuthHeader = authCacheKey;
        this.cachedClient = new Ollama({
            host,
            ...(authorizationHeader
                ? {
                      headers: {
                          Authorization: authorizationHeader,
                      },
                  }
                : {}),
        });

        return this.cachedClient;
    }

    private toAuthorizationHeader(
        token: string,
        mode: "bearer" | "raw" | "none",
    ): string | null {
        if (!token) {
            return null;
        }

        if (mode === "none") {
            return null;
        }

        if (mode === "raw") {
            return token.replace(/^Bearer\s+/i, "").trim();
        }

        return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
    }

    private isUnauthorizedError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        return /unauthorized|401/i.test(error.message);
    }

    private async executeWithAuthFallback<T>(
        host: string,
        token: string,
        callback: (client: Ollama) => Promise<T>,
    ): Promise<T> {
        const normalizedToken = token.trim();
        const modes: Array<"bearer" | "raw" | "none"> = normalizedToken
            ? ["bearer", "raw", "none"]
            : ["none"];

        let lastError: unknown = null;

        for (const mode of modes) {
            const client = this.getClient(host, normalizedToken, mode);
            const result = await attempt(() => callback(client));

            if (result.ok) {
                return result.value;
            }

            lastError = result.error;

            if (!this.isUnauthorizedError(result.error)) {
                throw result.error;
            }
        }

        if (lastError instanceof Error) {
            throw new Error(
                [
                    `Ollama auth failed (${lastError.message}).`,
                    `baseUrl=${host}`,
                    `tokenProvided=${normalizedToken.length > 0 ? "yes" : "no"}`,
                    "Проверьте token/host в настройках профиля и доступность Ollama API.",
                ].join(" "),
            );
        }

        throw new Error("Ollama auth failed: unknown error");
    }

    async *streamChat(
        payload: StreamOllamaChatPayload,
        token: string,
    ): AsyncGenerator<OllamaChatChunk> {
        const stream = await this.executeWithAuthFallback(
            Config.OLLAMA_BASE_URL.trim(),
            token,
            (client) =>
                client.chat({
                    model: payload.model,
                    messages: payload.messages as ChatRequest["messages"],
                    ...(payload.tools ? { tools: payload.tools } : {}),
                    ...(payload.format ? { format: payload.format } : {}),
                    ...(payload.think !== undefined
                        ? { think: payload.think }
                        : {}),
                    stream: true,
                }),
        );

        for await (const part of stream) {
            yield {
                model: part.model,
                created_at:
                    part.created_at instanceof Date
                        ? part.created_at.toISOString()
                        : String(part.created_at),
                message: {
                    role: part.message.role as OllamaRole,
                    content: part.message.content,
                    thinking: part.message.thinking,
                    tool_calls: part.message.tool_calls,
                },
                done: part.done,
                ...(typeof part.prompt_eval_count === "number"
                    ? { prompt_eval_count: part.prompt_eval_count }
                    : {}),
                ...(typeof part.eval_count === "number"
                    ? { eval_count: part.eval_count }
                    : {}),
            };
        }
    }

    async getEmbed(payload: GetEmbedPayload, token: string) {
        const response = await this.executeWithAuthFallback(
            LOCAL_OLLAMA_HOST,
            token,
            (client) =>
                client.embed({
                    model: payload.model,
                    input: payload.input,
                }),
        );

        const embeddingsSource = Array.isArray(response.embeddings)
            ? response.embeddings
            : [];
        const embeddings = embeddingsSource.map((vector) =>
            Array.isArray(vector) ? vector.map((value) => Number(value)) : [],
        );

        return {
            model: response.model,
            embeddings,
            ...(typeof response.total_duration === "number"
                ? { total_duration: response.total_duration }
                : {}),
            ...(typeof response.load_duration === "number"
                ? { load_duration: response.load_duration }
                : {}),
            ...(typeof response.prompt_eval_count === "number"
                ? { prompt_eval_count: response.prompt_eval_count }
                : {}),
        };
    }
}
