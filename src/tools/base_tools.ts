import { postOllamaJson } from "../services/api";
import { readAccessTokenFromLocalStorage } from "../services/api/authTokens";
import { Config } from "../config";
import { projectsStore } from "../stores/projectsStore";
import { ToolsBuilder } from "../utils/ToolsBuilder";
import {
    buildVectorStorageSearchUrl,
    clampVectorSearchLimit,
    normalizeVectorSearchResponse,
    toVectorSearchHits,
    type VectorSearchResponse,
} from "../services/api/vectorSearchShared";

const postToolRequest = async (
    endpoint: "web_search" | "web_fetch",
    payload: Record<string, unknown>,
) => {
    return postOllamaJson(endpoint, payload);
};

const searchVectorStorageByApi = async (
    vectorStorageId: string,
    query: string,
    topK: number,
): Promise<VectorSearchResponse> => {
    const api = window.appApi;
    const token = readAccessTokenFromLocalStorage();
    const url = buildVectorStorageSearchUrl(
        Config.ZVS_MAIN_BASE_URL,
        vectorStorageId,
    );
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const bodyText = JSON.stringify({ query, topK });

    if (api?.network?.proxyHttpRequest) {
        const result = await api.network.proxyHttpRequest({
            url,
            method: "POST",
            headers,
            bodyText,
        });

        if (!result.ok) {
            throw new Error(result.bodyText || result.statusText);
        }

        return normalizeVectorSearchResponse(result.bodyText);
    }

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: bodyText,
    });
    const raw = await response.text();

    if (!response.ok) {
        throw new Error(raw || `Request failed with status ${response.status}`);
    }

    return normalizeVectorSearchResponse(raw);
};

export const baseToolsPackage = () => {
    const builder = new ToolsBuilder();

    builder
        .addPackage({
            id: "base-tools",
            title: "Базовые инструменты",
            description:
                "Набор базовых инструментов для взаимодействия модели с внешней средой",
        })
        .addTool({
            name: "command_exec",
            description:
                "Выполняет shell-команду в указанной директории после подтверждения пользователем.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    command: ToolsBuilder.stringParam(
                        "Shell-команда для выполнения",
                    ),
                    cwd: ToolsBuilder.stringParam(
                        "Рабочая директория выполнения (опционально)",
                    ),
                },
                required: ["command"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    stdout: { type: "string" },
                    stderr: { type: "string" },
                    code: { type: "number" },
                },
            },
            execute: async (args) => {
                const command =
                    typeof args.command === "string" ? args.command : "";
                const cwd = typeof args.cwd === "string" ? args.cwd : undefined;

                const api = window.appApi;

                if (!api?.shell.execShellCommand) {
                    throw new Error(
                        "Командное выполнение недоступно в текущей среде",
                    );
                }

                return await api.shell.execShellCommand(command, cwd);
            },
        })
        .addTool({
            name: "vector_store_search_tool",
            description:
                "Ищет релевантные фрагменты в подключённом к текущему проекту векторном хранилище.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    query: ToolsBuilder.stringParam(
                        "Поисковый запрос по векторному хранилищу проекта",
                    ),
                    limit: ToolsBuilder.numberParam(
                        "Максимум результатов (по умолчанию 5, максимум 10)",
                    ),
                },
                required: ["query"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    vectorStorageId: { type: "string" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                document: { type: "string" },
                                metadata_json: { type: "string" },
                                distance: { type: "number" },
                            },
                        },
                    },
                    hits: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                text: { type: "string" },
                                score: { type: "number" },
                            },
                        },
                    },
                },
            },
            execute: async (args) => {
                const query = typeof args.query === "string" ? args.query : "";
                const limit = clampVectorSearchLimit(args.limit, 5);
                const activeProject = projectsStore.activeProject;
                const activeProjectId = activeProject?.id;
                const vectorStorageId = activeProject?.vecStorId?.trim() || "";

                if (!activeProjectId) {
                    throw new Error(
                        "vector_store_search_tool доступен только в чате проекта",
                    );
                }

                if (!vectorStorageId) {
                    throw new Error(
                        "К текущему проекту не подключено векторное хранилище",
                    );
                }

                const result = await searchVectorStorageByApi(
                    vectorStorageId,
                    query,
                    limit,
                );
                const items = Array.isArray(result.items) ? result.items : [];
                const hits = toVectorSearchHits(items);

                return {
                    vectorStorageId,
                    items,
                    hits,
                };
            },
        })
        .addTool({
            name: "web_search",
            description: "Ищет информацию в интернете по текстовому запросу.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    request: ToolsBuilder.stringParam("Поисковый запрос"),
                },
                required: ["request"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    result: { type: "string" },
                },
            },
            execute: async (args) => {
                const request =
                    typeof args.request === "string" ? args.request : "";

                return postToolRequest("web_search", { query: request });
            },
        })
        .addTool({
            name: "web_fetch",
            description: "Загружает содержимое веб-страницы по URL.",
            parameters: ToolsBuilder.objectSchema({
                properties: {
                    url: ToolsBuilder.stringParam("Абсолютный URL страницы"),
                },
                required: ["url"],
            }),
            outputScheme: {
                type: "object",
                properties: {
                    content: { type: "string" },
                },
            },
            execute: async (args) => {
                const url = typeof args.url === "string" ? args.url : "";

                return postToolRequest("web_fetch", { url });
            },
        })
        .done();

    return builder.build();
};
