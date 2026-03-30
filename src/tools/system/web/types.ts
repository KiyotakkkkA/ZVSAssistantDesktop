import type { ToolExecutionContext } from "../../runtime/contracts";

export type WebSearchPayload = {
    query: string;
    max_results: number;
};

export type WebFetchPayload = {
    url: string;
};

export type WebSearchSearchapiResponse = {
    provider: "searchapi";
    query: string;
    results: {
        title: string;
        link: string;
        snippet: string;
    }[];
};

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
    ) => Promise<unknown>;
    executeWebFetch: (
        payload: WebFetchPayload,
        context: ToolExecutionContext,
    ) => Promise<unknown>;
};
