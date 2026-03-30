import type { ToolExecutionContext } from "../../runtime/contracts";
import { Config } from "../../../../electron/config";
import type { WebFetchPayload, WebSearchPayload } from "./types";
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

export const executeOllamaWebSearch = async (
    payload: WebSearchPayload,
    context: ToolExecutionContext,
) => {
    return postToOllamaWebApi(
        "/api/web_search",
        payload,
        context.providerApiKey,
    );
};

export const executeOllamaWebFetch = async (
    payload: WebFetchPayload,
    context: ToolExecutionContext,
) => {
    return postToOllamaWebApi(
        "/api/web_fetch",
        payload,
        context.providerApiKey,
    );
};
