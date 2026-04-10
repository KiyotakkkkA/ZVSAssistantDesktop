import type { ToolExecutionContext } from "../../runtime/contracts";
import { Config } from "../../../../electron/config";
import type {
    WebFetchPayload,
    WebSearchPayload,
    WebSearchResult,
    WebToolResult,
} from "./types";
import { parseJsonSafely } from "../../../utils/tools/webTool";

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

const postToOllamaWebApi = async (
    endpoint: "/api/web_search" | "/api/web_fetch",
    payload: Record<string, unknown>,
    providerApiKey?: string,
): Promise<WebToolResult<Record<string, unknown>>> => {
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
            error: `Request failed with status ${response.status}`,
            details: parsed,
        };
    }

    return {
        ok: true,
        data: parsed as Record<string, unknown>,
    };
};

export const executeOllamaWebSearch = async (
    payload: WebSearchPayload,
    context: ToolExecutionContext,
): Promise<WebToolResult<WebSearchResult[]>> => {
    const results = await postToOllamaWebApi(
        "/api/web_search",
        payload,
        context.providerApiKey,
    );

    if (!results.ok) {
        return {
            error: results.error,
            details: results.details,
            ok: false,
        };
    }

    return {
        ok: true,
        data: (results.data as { results: WebSearchResult[] }).results,
    };
};

export const executeOllamaWebFetch = async (
    payload: WebFetchPayload,
    context: ToolExecutionContext,
): Promise<WebToolResult<unknown>> => {
    return postToOllamaWebApi(
        "/api/web_fetch",
        payload,
        context.providerApiKey,
    );
};
