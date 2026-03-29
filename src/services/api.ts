import { Config } from "../../electron/config";

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

export type OllamaWebSearchResult = {
    title: string;
    content: string;
    links: string;
};

export type OllamaWebFetchResult = {
    title: string;
    content: string;
    links: string;
};

const buildOllamaHeaders = (ollamaToken?: string): HeadersInit => {
    const trimmedToken = ollamaToken?.trim();

    if (!trimmedToken) {
        return {
            "Content-Type": "application/json",
        };
    }

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedToken}`,
    };
};

export const getOllamaModelsCatalog = async (): Promise<
    OllamaCatalogModel[]
> => {
    const rawResponse = await window.core.httpRequest(
        `${Config.OLLAMA_BASE_URL}/api/tags`,
        {
            method: "GET",
        },
    );

    const parsed = JSON.parse(rawResponse) as {
        models?: OllamaCatalogModel[];
    };

    return parsed.models ?? [];
};

export const callOllamaWebSearch = async (
    query: string,
    max_results: number,
    ollamaToken?: string,
): Promise<OllamaWebSearchResult> => {
    const response = await window.core.httpRequest(
        `${Config.OLLAMA_BASE_URL}/api/web_search`,
        {
            method: "POST",
            headers: buildOllamaHeaders(ollamaToken),
            body: JSON.stringify({ query, max_results }),
        },
    );

    return JSON.parse(response) as OllamaWebSearchResult;
};

export const callOllamaWebFetch = async (
    url: string,
    ollamaToken?: string,
): Promise<OllamaWebFetchResult> => {
    const response = await window.core.httpRequest(
        `${Config.OLLAMA_BASE_URL}/api/web_fetch`,
        {
            method: "POST",
            headers: buildOllamaHeaders(ollamaToken),
            body: JSON.stringify({ url }),
        },
    );

    return JSON.parse(response) as OllamaWebFetchResult;
};
