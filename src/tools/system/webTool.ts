import { z } from "zod";
import { Config } from "../../../electron/config";
import type { ToolDefinition } from "../runtime/contracts";

const webSearchToolInputSchema = z.object({
    query: z.string().min(1),
    max_results: z.number().int().positive().max(20).optional(),
});

const webFetchToolInputSchema = z.object({
    url: z.string().url(),
});

const buildRequestHeaders = (ollamaApiKey?: string): HeadersInit => {
    const token = ollamaApiKey?.trim();

    if (!token) {
        return {
            "Content-Type": "application/json",
        };
    }

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
};

const postToOllamaWebApi = async (
    endpoint: "/api/web_search" | "/api/web_fetch",
    payload: Record<string, unknown>,
    ollamaApiKey?: string,
) => {
    const response = await fetch(`${Config.OLLAMA_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: buildRequestHeaders(ollamaApiKey),
        body: JSON.stringify(payload),
    });

    const raw = await response.text();

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = { raw };
    }

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: `Request failed with status ${response.status}`,
            details: parsed,
        };
    }

    return parsed;
};

export const webSearchTool: ToolDefinition = {
    name: "web_search",
    description:
        "Ищет информацию в интернете по запросу и возвращает результат поиска.",
    inputSchema: webSearchToolInputSchema,
    execute: async (args, context) => {
        const { query, max_results } = webSearchToolInputSchema.parse(args);

        return postToOllamaWebApi(
            "/api/web_search",
            {
                query,
                max_results: max_results ?? 5,
            },
            context.ollamaApiKey,
        );
    },
};

export const webFetchTool: ToolDefinition = {
    name: "web_fetch",
    description:
        "Загружает содержимое по URL и возвращает извлеченный текст/данные страницы.",
    inputSchema: webFetchToolInputSchema,
    execute: async (args, context) => {
        const { url } = webFetchToolInputSchema.parse(args);

        return postToOllamaWebApi(
            "/api/web_fetch",
            { url },
            context.ollamaApiKey,
        );
    },
};
