import { z } from "zod";
import type { ToolDefinition } from "../runtime/contracts";
import type { AllowedWebToolsProviders } from "../../../electron/models/user";
import {
    executeOllamaWebFetch,
    executeOllamaWebSearch,
} from "./web/ollamaStrategy";
import {
    executeCustomWebFetch,
    executeSearchapiWebSearch,
} from "./web/searchapiStrategy";
import type { WebToolsStrategy } from "./web/types";

const webSearchToolInputSchema = z.object({
    query: z.string().min(1),
    max_results: z.number().int().positive().max(20).optional(),
});

const webFetchToolInputSchema = z.object({
    url: z.string().url(),
});

const ollamaWebToolsStrategy: WebToolsStrategy = {
    executeWebSearch: executeOllamaWebSearch,
    executeWebFetch: executeOllamaWebFetch,
};

const searchapiWebToolsStrategy: WebToolsStrategy = {
    executeWebSearch: executeSearchapiWebSearch,
    executeWebFetch: executeCustomWebFetch,
};

const webToolsStrategies: Record<AllowedWebToolsProviders, WebToolsStrategy> = {
    ollama: ollamaWebToolsStrategy,
    searchapi: searchapiWebToolsStrategy,
};

const resolveWebToolsProvider = (
    provider?: AllowedWebToolsProviders,
): AllowedWebToolsProviders => {
    return provider === "searchapi" ? "searchapi" : "ollama";
};

export const webSearchTool: ToolDefinition = {
    name: "web_search",
    description:
        "Ищет информацию в интернете по запросу и возвращает результат поиска.",
    inputSchema: webSearchToolInputSchema,
    execute: async (args, context) => {
        const { query, max_results } = webSearchToolInputSchema.parse(args);
        const strategy =
            webToolsStrategies[
                resolveWebToolsProvider(context.webToolsProvider)
            ];

        const result = await strategy.executeWebSearch(
            {
                query,
                max_results: max_results ?? 5,
            },
            context,
        );

        return result;
    },
};

export const webFetchTool: ToolDefinition = {
    name: "web_fetch",
    description:
        "Загружает содержимое по URL и возвращает извлеченный текст/данные страницы.",
    inputSchema: webFetchToolInputSchema,
    execute: async (args, context) => {
        const { url } = webFetchToolInputSchema.parse(args);
        const strategy =
            webToolsStrategies[
                resolveWebToolsProvider(context.webToolsProvider)
            ];

        return await strategy.executeWebFetch({ url }, context);
    },
};
