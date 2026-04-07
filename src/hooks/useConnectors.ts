import { useCallback, useState } from "react";
import { useToasts } from "./useToasts";

type ConnectorProvider = "github" | "gitlab";

type GithubBranchRecord = {
    name: string;
};

type GitlabBranchRecord = {
    name: string;
    default?: boolean;
};

export type ConnectorParseData = {
    provider: ConnectorProvider;
    repoUrl: string;
    repoPath: string;
    branches: string[];
    defaultBranch: string;
};

const parseGithubRepoPath = (repoUrl: string) => {
    let url: URL;

    try {
        url = new URL(repoUrl.trim());
    } catch {
        throw new Error("Введите корректный URL репозитория GitHub.");
    }

    if (!url.hostname.toLowerCase().includes("github.com")) {
        throw new Error("Для GitHub укажите ссылку на github.com.");
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    const owner = pathSegments[0];
    const rawRepo = pathSegments[1];

    if (!owner || !rawRepo) {
        throw new Error("Не удалось определить owner/repo из URL GitHub.");
    }

    const repo = rawRepo.replace(/\.git$/i, "");

    const hostname = url.hostname.toLowerCase();
    const apiBaseUrl =
        hostname === "github.com" || hostname === "www.github.com"
            ? "https://api.github.com"
            : `${url.protocol}//${url.host}/api/v3`;

    return {
        apiBaseUrl,
        repoPath: `${owner}/${repo}`,
    };
};

const parseGitlabRepoPath = (repoUrl: string) => {
    let url: URL;

    try {
        url = new URL(repoUrl.trim());
    } catch {
        throw new Error("Введите корректный URL репозитория GitLab.");
    }

    const normalizedPath = url.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/-/")[0]
        .replace(/\.git$/i, "");

    if (!normalizedPath || normalizedPath.split("/").length < 2) {
        throw new Error("Не удалось определить путь репозитория GitLab.");
    }

    return {
        origin: `${url.protocol}//${url.host}`,
        repoPath: normalizedPath,
    };
};

export const useConnectors = () => {
    const toast = useToasts();

    const [data, setData] = useState<ConnectorParseData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const runParse = useCallback(
        async (action: () => Promise<ConnectorParseData>) => {
            setIsLoading(true);
            setIsError(false);
            setIsSuccess(false);

            try {
                const parsedData = await action();
                setData(parsedData);
                setIsSuccess(true);
                return parsedData;
            } catch (error) {
                const errorMessage =
                    (error as Error).message ||
                    "Не удалось получить данные репозитория.";
                setData(null);
                setIsError(true);
                toast.danger({
                    title: "Ошибка подключения",
                    description: errorMessage,
                });
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [toast],
    );

    const githubRepoParse = useCallback(
        async (repoUrl: string, token?: string) => {
            return runParse(async () => {
                const trimmedRepoUrl = repoUrl.trim();

                if (!trimmedRepoUrl) {
                    throw new Error("Укажите URL репозитория GitHub.");
                }

                const { apiBaseUrl, repoPath } =
                    parseGithubRepoPath(trimmedRepoUrl);
                const headers: Record<string, string> = {
                    Accept: "application/vnd.github+json",
                };

                const trimmedToken = token?.trim();
                if (trimmedToken) {
                    headers.Authorization = `Bearer ${trimmedToken}`;
                }

                const response = await window.core.httpRequest(
                    `${apiBaseUrl}/repos/${repoPath}/branches?per_page=100`,
                    {
                        method: "GET",
                        headers,
                    },
                );

                const parsedResponse = JSON.parse(response) as
                    | GithubBranchRecord[]
                    | { message?: string };

                if (!Array.isArray(parsedResponse)) {
                    throw new Error(
                        parsedResponse.message ||
                            "GitHub вернул неожиданный формат ответа.",
                    );
                }

                const branches = parsedResponse.map((branch) => branch.name);

                if (branches.length === 0) {
                    throw new Error(
                        "В репозитории GitHub не найдено ни одной ветки.",
                    );
                }

                return {
                    provider: "github",
                    repoUrl: trimmedRepoUrl,
                    repoPath,
                    branches,
                    defaultBranch: branches[0],
                } satisfies ConnectorParseData;
            });
        },
        [runParse],
    );

    const gitlabRepoParse = useCallback(
        async (repoUrl: string, token?: string) => {
            return runParse(async () => {
                const trimmedRepoUrl = repoUrl.trim();

                if (!trimmedRepoUrl) {
                    throw new Error("Укажите URL репозитория GitLab.");
                }

                const { origin, repoPath } =
                    parseGitlabRepoPath(trimmedRepoUrl);
                const headers: Record<string, string> = {};

                const trimmedToken = token?.trim();
                if (trimmedToken) {
                    headers["PRIVATE-TOKEN"] = trimmedToken;
                }

                const response = await window.core.httpRequest(
                    `${origin}/api/v4/projects/${encodeURIComponent(repoPath)}/repository/branches?per_page=100`,
                    {
                        method: "GET",
                        headers,
                    },
                );

                const parsedResponse = JSON.parse(response) as
                    | GitlabBranchRecord[]
                    | { message?: string | string[] };

                if (!Array.isArray(parsedResponse)) {
                    const message = Array.isArray(parsedResponse.message)
                        ? parsedResponse.message.join(" ")
                        : parsedResponse.message;

                    throw new Error(
                        message || "GitLab вернул неожиданный формат ответа.",
                    );
                }

                const branches = parsedResponse.map((branch) => branch.name);

                if (branches.length === 0) {
                    throw new Error(
                        "В репозитории GitLab не найдено ни одной ветки.",
                    );
                }

                const defaultBranch =
                    parsedResponse.find((branch) => branch.default)?.name ||
                    branches[0];

                return {
                    provider: "gitlab",
                    repoUrl: trimmedRepoUrl,
                    repoPath,
                    branches,
                    defaultBranch,
                } satisfies ConnectorParseData;
            });
        },
        [runParse],
    );

    return {
        data,
        isLoading,
        isError,
        isSuccess,
        githubRepoParse,
        gitlabRepoParse,
    };
};
