import type { ToolExecutionContext } from "../../runtime/contracts";
import {
    extractHtmlLinks,
    extractHtmlText,
    extractHtmlTitle,
    normalizeWhitespace,
    parseJsonSafely,
} from "../../../utils/tools/webTool";
import type {
    WebFetchPayload,
    WebFetchSearchapiResponse,
    WebSearchPayload,
    WebSearchResult,
    WebToolResult,
} from "./types";

const searchApiSearchEndpoint = "https://www.searchapi.io/api/v1/search";
const contentPreviewLimit = 12000;
const defaultFetchUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const executeSearchapiWebSearch = async (
    payload: WebSearchPayload,
    context: ToolExecutionContext,
): Promise<WebToolResult<WebSearchResult[]>> => {
    const token = context.providerApiKey?.trim();
    if (!token) {
        return {
            ok: false,
            error: "SearchAPI token is not configured",
        };
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

    if (!response.ok) {
        return {
            ok: false,
            error: `SearchAPI request failed with status ${response.status}`,
            details: parseJsonSafely(raw),
        };
    }

    const parsedRecord = JSON.parse(raw) as {
        organic_results: {
            title: string;
            link: string;
            snippet: string;
        }[];
    };
    const organicResults = parsedRecord.organic_results ?? [];

    const results = organicResults.slice(0, payload.max_results).map((item) => {
        return {
            title: item.title,
            url: item.link,
            content: item.snippet,
        } as WebSearchResult;
    });

    return {
        ok: true,
        data: results,
    };
};

export const executeCustomWebFetch = async (
    payload: WebFetchPayload,
): Promise<WebToolResult<WebFetchSearchapiResponse>> => {
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
        ok: true,
        data: {
            provider: "searchapi",
            url: payload.url,
            status: response.status,
            title,
            content: extractedText.slice(0, contentPreviewLimit),
            links,
        },
    };
};
