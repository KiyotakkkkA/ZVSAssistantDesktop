import { Config } from "../../config";
import { userProfileStore } from "../../stores/userProfileStore";
import type {
    OllamaChatChunk,
    OllamaMessage,
    OllamaResponseFormat,
    OllamaRole,
    OllamaToolDefinition,
} from "../../types/Chat";
import type {
    ProxyHttpRequestPayload,
    StreamOllamaChatPayload,
} from "../../types/ElectronApi";

export type OllamaCatalogModelDetails = {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
};

export type OllamaCatalogModel = {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: OllamaCatalogModelDetails;
};

export type OllamaCatalogResponse = {
    models: OllamaCatalogModel[];
};

type StreamRequestOptions<TChunk> = {
    signal?: AbortSignal;
    onChunk: (chunk: TChunk) => void;
};

const createAbortError = () =>
    new DOMException("Request was aborted", "AbortError");

const toSerializable = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;

const proxyHttpRequest = async ({
    url,
    method,
    headers,
    bodyText,
}: ProxyHttpRequestPayload): Promise<string> => {
    const api = window.appApi;

    if (api?.network?.proxyHttpRequest) {
        const result = await api.network.proxyHttpRequest({
            url,
            method,
            headers,
            bodyText,
        });

        if (!result.ok) {
            throw new Error(result.bodyText || result.statusText);
        }

        return result.bodyText;
    }

    const response = await fetch(url, {
        method,
        headers,
        ...(bodyText && method !== "GET" && method !== "HEAD"
            ? { body: bodyText }
            : {}),
    });

    const raw = await response.text();
    if (!response.ok) {
        throw new Error(raw || `Request failed with status ${response.status}`);
    }

    return raw;
};

const createOllamaAuthHeaders = () => {
    const ollamaToken = userProfileStore.userProfile.ollamaToken.trim();

    return {
        "Content-Type": "application/json",
        ...(ollamaToken
            ? {
                  Authorization: `Bearer ${ollamaToken}`,
              }
            : {}),
    };
};

export const streamOllamaChat = async (
    payload: {
        model: string;
        messages: OllamaMessage[];
        tools?: OllamaToolDefinition[];
        format?: OllamaResponseFormat;
        think?: boolean;
    },
    options: StreamRequestOptions<OllamaChatChunk>,
): Promise<void> => {
    const { signal, onChunk } = options;

    if (signal?.aborted) {
        throw createAbortError();
    }

    const llmApi = window.appApi?.llm;

    if (!llmApi?.streamOllamaChat) {
        throw new Error("LLM API is not available in current environment");
    }

    const requestPayload: StreamOllamaChatPayload = {
        model: payload.model,
        messages: toSerializable(payload.messages ?? []),
        ...(payload.tools ? { tools: toSerializable(payload.tools) } : {}),
        ...(payload.format ? { format: toSerializable(payload.format) } : {}),
        ...(payload.think !== undefined ? { think: payload.think } : {}),
    };

    const chunks = await llmApi.streamOllamaChat(requestPayload);

    for (const part of chunks) {
        if (signal?.aborted) {
            throw createAbortError();
        }

        onChunk({
            model: part.model,
            created_at: part.created_at,
            message: {
                role: part.message?.role as OllamaRole,
                content: part.message?.content,
                thinking: part.message?.thinking,
                tool_calls: part.message?.tool_calls,
            },
            done: part.done,
            ...(typeof part.prompt_eval_count === "number"
                ? { prompt_eval_count: part.prompt_eval_count }
                : {}),
            ...(typeof part.eval_count === "number"
                ? { eval_count: part.eval_count }
                : {}),
        });

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
    }
};

export const postOllamaJson = async <TResponse = unknown>(
    endpoint: string,
    payload: Record<string, unknown>,
): Promise<TResponse> => {
    const normalizedEndpoint = endpoint.replace(/^\/+/, "");
    const raw = await proxyHttpRequest({
        url: `${Config.OLLAMA_BASE_URL}/api/${normalizedEndpoint}`,
        method: "POST",
        headers: createOllamaAuthHeaders(),
        bodyText: JSON.stringify(payload),
    });

    return raw ? (JSON.parse(raw) as TResponse) : ({} as TResponse);
};

export const getOllamaModelsCatalog = async (): Promise<
    OllamaCatalogModel[]
> => {
    const raw = await proxyHttpRequest({
        url: "https://ollama.com/api/tags",
        method: "GET",
    });

    if (!raw) {
        return [];
    }

    const parsed = JSON.parse(raw) as OllamaCatalogResponse;
    if (!Array.isArray(parsed.models)) {
        return [];
    }

    return parsed.models;
};
