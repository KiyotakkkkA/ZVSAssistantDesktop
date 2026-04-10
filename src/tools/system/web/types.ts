import type { ToolExecutionContext } from "../../runtime/contracts";

export type WebSearchPayload = {
    query: string;
    max_results: number;
};

export type WebFetchPayload = {
    url: string;
};

export type WebSearchResult = {
    title: string;
    url: string;
    content: string;
};

export type WebToolError = {
    ok: false;
    error: string;
    details?: unknown;
};

export type WebToolSuccess<T> = {
    ok: true;
    data: T;
};

export type WebToolResult<T> = WebToolSuccess<T> | WebToolError;

export type WebFetchSearchapiResponse = {
    provider: "searchapi";
    url: string;
    status: number;
    title: string;
    content: string;
    links: string[];
};

export type WebToolsStrategy = {
    executeWebSearch: (
        payload: WebSearchPayload,
        context: ToolExecutionContext,
    ) => Promise<WebToolResult<WebSearchResult[]>>;
    executeWebFetch: (
        payload: WebFetchPayload,
        context: ToolExecutionContext,
    ) => Promise<WebToolResult<unknown>>;
};
