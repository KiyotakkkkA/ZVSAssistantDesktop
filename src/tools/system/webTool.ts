import { z } from "zod";
import type {
    ToolDefinition,
    ToolExecutionContext,
} from "../runtime/contracts";
import type { AllowedWebToolsProviders } from "../../../electron/models/user";
import { Config } from "../../../electron/config";

const webSearchToolInputSchema = z.object({
    query: z.string().min(1),
    max_results: z.number().int().positive().max(20).optional(),
});

const webFetchToolInputSchema = z.object({
    url: z.string().url(),
});

const searchApiSearchEndpoint = "https://www.searchapi.io/api/v1/search";
const contentPreviewLimit = 12000;
const defaultFetchUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type WebSearchPayload = {
    query: string;
    max_results: number;
};

type WebFetchPayload = {
    url: string;
};

type WebToolsStrategy = {
    executeWebSearch: (
        payload: WebSearchPayload,
        context: ToolExecutionContext,
    ) => Promise<unknown>;
    executeWebFetch: (
        payload: WebFetchPayload,
        context: ToolExecutionContext,
    ) => Promise<unknown>;
};

const buildRequestHeaders = (providerApiKey?: string): HeadersInit => {
    const token = providerApiKey?.trim();

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

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
};

const parseJsonSafely = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return {
            raw,
        };
    }
};

const normalizeWhitespace = (value: string) => {
    return value
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const decodeHtmlEntities = (value: string) => {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&hellip;/gi, "...");
};

const extractHtmlTitle = (html: string): string => {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch) {
        return "";
    }

    return normalizeWhitespace(decodeHtmlEntities(titleMatch[1] ?? ""));
};

const extractHtmlLinks = (html: string, pageUrl: string): string[] => {
    const hrefRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
    const links = new Set<string>();

    for (const match of html.matchAll(hrefRegex)) {
        const rawHref = (match[1] ?? "").trim();
        if (!rawHref) {
            continue;
        }

        try {
            const absoluteUrl = new URL(rawHref, pageUrl).toString();
            links.add(absoluteUrl);
            if (links.size >= 20) {
                break;
            }
        } catch {
            // Ignore invalid links in malformed HTML.
        }
    }

    return Array.from(links);
};

const extractHtmlText = (html: string): string => {
    const withoutScripts = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(
            /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
            " ",
        );

    const withBreaks = withoutScripts.replace(
        /<\/?(p|div|h1|h2|h3|h4|h5|h6|li|br|tr|section|article|main|header|footer|blockquote)\b[^>]*>/gi,
        "\n",
    );

    const rawText = withBreaks.replace(/<[^>]+>/g, " ");

    return normalizeWhitespace(decodeHtmlEntities(rawText));
};

const postToOllamaWebApi = async (
    endpoint: "/api/web_search" | "/api/web_fetch",
    payload: Record<string, unknown>,
    providerApiKey?: string,
) => {
    const response = await fetch(`${Config.OLLAMA_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: buildRequestHeaders(providerApiKey),
        body: JSON.stringify(payload),
    });

    const raw = await response.text();

    const parsed = parseJsonSafely(raw);

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

const executeSearchapiWebSearch = async (
    payload: WebSearchPayload,
    context: ToolExecutionContext,
) => {
    const token = context.providerApiKey?.trim();
    if (!token) {
        throw new Error("SearchAPI token is not configured");
    }

    const requestUrl = new URL(searchApiSearchEndpoint);
    requestUrl.searchParams.set("engine", "google");
    requestUrl.searchParams.set("q", payload.query);
    requestUrl.searchParams.set("num", String(payload.max_results));

    const response = await fetch(requestUrl.toString(), {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    const raw = await response.text();
    const parsed = parseJsonSafely(raw);

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: `SearchAPI request failed with status ${response.status}`,
            details: parsed,
        };
    }

    const parsedRecord = asRecord(parsed);
    const organicResults = Array.isArray(parsedRecord?.organic_results)
        ? (parsedRecord.organic_results as unknown[])
        : [];

    const results = organicResults.slice(0, payload.max_results).map((item) => {
        const result = asRecord(item);
        return {
            title:
                typeof result?.title === "string"
                    ? result.title
                    : "Untitled result",
            link: typeof result?.link === "string" ? result.link : "",
            snippet: typeof result?.snippet === "string" ? result.snippet : "",
        };
    });

    return {
        provider: "searchapi",
        query: payload.query,
        results,
        answer_box: parsedRecord?.answer_box,
    };
};

const executeCustomWebFetch = async (payload: WebFetchPayload) => {
    const response = await fetch(payload.url, {
        method: "GET",
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
            "User-Agent": defaultFetchUserAgent,
        },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const rawBody = await response.text();

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            error: `Request failed with status ${response.status}`,
            details: parseJsonSafely(rawBody),
        };
    }

    const isHtmlResponse = /text\/html|application\/xhtml\+xml/i.test(
        contentType,
    );
    const title = isHtmlResponse ? extractHtmlTitle(rawBody) : "";
    const links = isHtmlResponse ? extractHtmlLinks(rawBody, payload.url) : [];
    const extractedText = isHtmlResponse
        ? extractHtmlText(rawBody)
        : normalizeWhitespace(rawBody);

    return {
        provider: "searchapi",
        url: payload.url,
        status: response.status,
        title,
        content: extractedText.slice(0, contentPreviewLimit),
        links,
    };
};

const ollamaWebToolsStrategy: WebToolsStrategy = {
    executeWebSearch: async (payload, context) => {
        return postToOllamaWebApi(
            "/api/web_search",
            payload,
            context.providerApiKey,
        );
    },
    executeWebFetch: async (payload, context) => {
        return postToOllamaWebApi(
            "/api/web_fetch",
            payload,
            context.providerApiKey,
        );
    },
};

const searchapiWebToolsStrategy: WebToolsStrategy = {
    executeWebSearch: executeSearchapiWebSearch,
    executeWebFetch: executeCustomWebFetch,
};

const webToolsStrategies: Record<AllowedWebToolsProviders, WebToolsStrategy> = {
    ollama: ollamaWebToolsStrategy,
    searchapi: searchapiWebToolsStrategy,
};

export const webSearchTool: ToolDefinition = {
    name: "web_search",
    description:
        "Ищет информацию в интернете по запросу и возвращает результат поиска.",
    inputSchema: webSearchToolInputSchema,
    execute: async (args, context) => {
        const { query, max_results } = webSearchToolInputSchema.parse(args);

        return webToolsStrategies[
            context.webToolsProvider as AllowedWebToolsProviders
        ].executeWebSearch(
            {
                query,
                max_results: max_results ?? 5,
            },
            context,
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

        return webToolsStrategies[
            context.webToolsProvider as AllowedWebToolsProviders
        ].executeWebFetch({ url }, context);
    },
};
