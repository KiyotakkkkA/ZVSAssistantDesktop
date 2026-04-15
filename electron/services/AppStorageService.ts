import fs from "node:fs";
import path from "node:path";
import type { JobEventTag, StorageRepositorySyncPayload } from "../models/job";
import type { StorageRepository } from "../repositories/StorageRepository";
import { createStorageFolderId } from "../../src/utils/creators";

type RemoteRepositoryFile = {
    path: string;
    sha?: string;
};

type SyncRepositoryCallbacks = {
    signal: AbortSignal;
    onStage: (message: string, tag?: JobEventTag) => void;
};

type GitHubRepositoryData = {
    apiBaseUrl: string;
    repoPath: string;
};

type GitLabRepositoryData = {
    origin: string;
    repoPath: string;
};

type SyncRepositoryResult = {
    folderId: string;
    folderName: string;
    downloadedCount: number;
    skippedCount: number;
};

export class AppStorageService {
    private readonly downloadBatchSize = 8;

    constructor(private readonly storageRepository: StorageRepository) {}

    async syncRepository(
        payload: StorageRepositorySyncPayload,
        callbacks: SyncRepositoryCallbacks,
    ): Promise<SyncRepositoryResult> {
        const normalizedProvider = payload.provider;
        const repoUrl = payload.repoUrl.trim();
        const branch = payload.branch.trim();
        const token = payload.token?.trim();
        const ignorePatterns = payload.ignorePatterns ?? [];

        if (!repoUrl) {
            throw new Error("Не указан URL репозитория");
        }

        if (!branch) {
            throw new Error("Не указана ветка репозитория");
        }

        callbacks.onStage("Подготовка папки хранилища", "info");

        const folderName = this.resolveFolderName(payload.folderName, repoUrl);
        const folder = this.ensureStorageFolder(folderName);
        this.clearDirectory(folder.path);

        callbacks.onStage("Получение списка файлов репозитория", "info");

        const repositoryFiles =
            normalizedProvider === "github"
                ? await this.getGitHubRepositoryFiles(
                      repoUrl,
                      branch,
                      token,
                      callbacks,
                  )
                : await this.getGitLabRepositoryFiles(
                      repoUrl,
                      branch,
                      token,
                      callbacks,
                  );

        const isIgnored = this.createIgnoreMatcher(ignorePatterns);
        const filesForDownload = repositoryFiles.filter(
            (file) => !isIgnored(file.path),
        );
        const skippedCount = repositoryFiles.length - filesForDownload.length;

        if (filesForDownload.length === 0) {
            this.storageRepository.refreshFolderContent(folder.id);

            callbacks.onStage(
                "Синхронизация завершена: подходящие файлы не найдены",
                "warning",
            );

            return {
                folderId: folder.id,
                folderName: folder.name,
                downloadedCount: 0,
                skippedCount,
            };
        }

        const progressStep = Math.max(
            1,
            Math.floor(filesForDownload.length / 40),
        );
        let downloadedCount = 0;
        const totalFiles = filesForDownload.length;
        const workerCount = Math.min(this.downloadBatchSize, totalFiles);
        let nextIndex = 0;

        callbacks.onStage(
            `Загрузка файлов пакетами (параллельно: ${workerCount})`,
            "info",
        );

        const runWorker = async () => {
            while (nextIndex < totalFiles) {
                this.throwIfAborted(callbacks.signal);

                const currentIndex = nextIndex;
                nextIndex += 1;

                if (currentIndex >= totalFiles) {
                    break;
                }

                const file = filesForDownload[currentIndex];
                const content =
                    normalizedProvider === "github"
                        ? await this.downloadGitHubFile(
                              repoUrl,
                              token,
                              file,
                              callbacks.signal,
                          )
                        : await this.downloadGitLabFile(
                              repoUrl,
                              branch,
                              token,
                              file,
                              callbacks.signal,
                          );

                this.writeFileToStorageFolder(folder.path, file.path, content);
                downloadedCount += 1;

                const isBoundary =
                    downloadedCount === 1 ||
                    downloadedCount === totalFiles ||
                    downloadedCount % progressStep === 0;

                if (isBoundary) {
                    const progress = Math.round(
                        (downloadedCount / totalFiles) * 100,
                    );

                    callbacks.onStage(
                        `Загрузка файлов: ${downloadedCount}/${totalFiles} (${progress}%)`,
                        "info",
                    );
                }
            }
        };

        await Promise.all(
            Array.from({ length: workerCount }, () => runWorker()),
        );

        callbacks.onStage("Обновление индекса файлов в базе данных", "info");
        this.storageRepository.refreshFolderContent(folder.id);

        callbacks.onStage("Синхронизация репозитория завершена", "success");

        return {
            folderId: folder.id,
            folderName: folder.name,
            downloadedCount,
            skippedCount,
        };
    }

    private ensureStorageFolder(folderName: string) {
        const existingFolder =
            this.storageRepository.findFolderByName(folderName);

        if (existingFolder) {
            if (!fs.existsSync(existingFolder.path)) {
                fs.mkdirSync(existingFolder.path, { recursive: true });
            }

            return existingFolder;
        }

        return this.storageRepository.createStorageFolder({
            id: createStorageFolderId(),
            name: folderName,
        });
    }

    private resolveFolderName(
        folderName: string | undefined,
        repoUrl: string,
    ): string {
        const normalizedFolderName = folderName?.trim();

        if (normalizedFolderName) {
            return normalizedFolderName;
        }

        try {
            const url = new URL(repoUrl);
            const parts = url.pathname
                .replace(/^\/+|\/+$/g, "")
                .replace(/\.git$/i, "")
                .split("/")
                .filter(Boolean);

            return parts.at(-1) || "repository";
        } catch {
            return "repository";
        }
    }

    private clearDirectory(directoryPath: string): void {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
            return;
        }

        for (const entry of fs.readdirSync(directoryPath)) {
            fs.rmSync(path.join(directoryPath, entry), {
                recursive: true,
                force: true,
            });
        }
    }

    private createIgnoreMatcher(
        patterns: string[],
    ): (relativePath: string) => boolean {
        const rules = patterns
            .map((pattern) => pattern.trim())
            .filter((pattern) => pattern.length > 0 && !pattern.startsWith("#"))
            .map((pattern) => {
                const isNegated = pattern.startsWith("!");
                const normalizedPattern = isNegated
                    ? pattern.slice(1).trim()
                    : pattern;

                return {
                    isNegated,
                    regex: this.globToRegExp(normalizedPattern),
                };
            });

        return (relativePath: string) => {
            const normalizedPath = relativePath.replace(/\\/g, "/");

            let isIgnored = false;

            for (const rule of rules) {
                if (!rule.regex.test(normalizedPath)) {
                    continue;
                }

                isIgnored = !rule.isNegated;
            }

            return isIgnored;
        };
    }

    private globToRegExp(pattern: string): RegExp {
        let normalized = pattern
            .replace(/\\/g, "/")
            .replace(/^\.?\//, "")
            .trim();

        if (!normalized) {
            return /^$/;
        }

        if (normalized.endsWith("/")) {
            normalized = `${normalized}**`;
        }

        const isAnchored = normalized.startsWith("/");

        if (isAnchored) {
            normalized = normalized.slice(1);
        }

        let regexBody = "";

        for (let index = 0; index < normalized.length; index += 1) {
            const char = normalized[index];
            const nextChar = normalized[index + 1];

            if (char === "*" && nextChar === "*") {
                regexBody += ".*";
                index += 1;
                continue;
            }

            if (char === "*") {
                regexBody += "[^/]*";
                continue;
            }

            if (char === "?") {
                regexBody += "[^/]";
                continue;
            }

            regexBody += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
        }

        const prefix = isAnchored ? "^" : "^(?:|.*/)";

        return new RegExp(`${prefix}${regexBody}$`);
    }

    private writeFileToStorageFolder(
        folderPath: string,
        relativeFilePath: string,
        content: Buffer,
    ): void {
        const normalizedRelativePath = relativeFilePath
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");
        const pathParts = normalizedRelativePath.split("/").filter(Boolean);

        if (pathParts.length === 0) {
            return;
        }

        const absolutePath = path.join(folderPath, ...pathParts);

        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, content);
    }

    private async getGitHubRepositoryFiles(
        repoUrl: string,
        branch: string,
        token: string | undefined,
        callbacks: SyncRepositoryCallbacks,
    ): Promise<RemoteRepositoryFile[]> {
        const { apiBaseUrl, repoPath } = this.parseGitHubRepoData(repoUrl);
        const headers = this.createGitHubHeaders(token);
        const treeUrl = `${apiBaseUrl}/repos/${repoPath}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const response = await this.fetchJson<{
            tree?: Array<{
                path?: string;
                type?: string;
                sha?: string;
            }>;
            truncated?: boolean;
        }>(treeUrl, {
            method: "GET",
            headers,
            signal: callbacks.signal,
        });

        if (response.truncated) {
            callbacks.onStage(
                "Список файлов GitHub усечен API из-за большого объема",
                "warning",
            );
        }

        return (response.tree ?? [])
            .filter((entry) => entry.type === "blob" && entry.path && entry.sha)
            .map((entry) => ({
                path: entry.path as string,
                sha: entry.sha as string,
            }));
    }

    private async getGitLabRepositoryFiles(
        repoUrl: string,
        branch: string,
        token: string | undefined,
        callbacks: SyncRepositoryCallbacks,
    ): Promise<RemoteRepositoryFile[]> {
        const { origin, repoPath } = this.parseGitLabRepoData(repoUrl);
        const headers = this.createGitLabHeaders(token);
        const files: RemoteRepositoryFile[] = [];
        let page = 1;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this.throwIfAborted(callbacks.signal);

            const treeUrl = `${origin}/api/v4/projects/${encodeURIComponent(repoPath)}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`;
            const response = await this.fetchResponse(treeUrl, {
                method: "GET",
                headers,
                signal: callbacks.signal,
            });
            const payload = (await response.json()) as Array<{
                type?: string;
                path?: string;
            }>;

            for (const entry of payload) {
                if (entry.type !== "blob" || !entry.path) {
                    continue;
                }

                files.push({
                    path: entry.path,
                });
            }

            const nextPage = response.headers.get("x-next-page");

            if (!nextPage) {
                break;
            }

            page = Number(nextPage);

            if (!Number.isFinite(page) || page <= 0) {
                break;
            }
        }

        return files;
    }

    private async downloadGitHubFile(
        repoUrl: string,
        token: string | undefined,
        file: RemoteRepositoryFile,
        signal: AbortSignal,
    ): Promise<Buffer> {
        if (!file.sha) {
            throw new Error(`Не найден SHA для файла ${file.path}`);
        }

        const { apiBaseUrl, repoPath } = this.parseGitHubRepoData(repoUrl);
        const headers = this.createGitHubHeaders(token);
        const blobUrl = `${apiBaseUrl}/repos/${repoPath}/git/blobs/${file.sha}`;
        const payload = await this.fetchJson<{
            encoding?: string;
            content?: string;
        }>(blobUrl, {
            method: "GET",
            headers,
            signal,
        });

        const encoding = payload.encoding?.toLowerCase();
        const content = payload.content ?? "";

        if (encoding === "base64") {
            return Buffer.from(content.replace(/\n/g, ""), "base64");
        }

        return Buffer.from(content, "utf-8");
    }

    private async downloadGitLabFile(
        repoUrl: string,
        branch: string,
        token: string | undefined,
        file: RemoteRepositoryFile,
        signal: AbortSignal,
    ): Promise<Buffer> {
        const { origin, repoPath } = this.parseGitLabRepoData(repoUrl);
        const headers = this.createGitLabHeaders(token);
        const fileUrl = `${origin}/api/v4/projects/${encodeURIComponent(repoPath)}/repository/files/${encodeURIComponent(file.path)}/raw?ref=${encodeURIComponent(branch)}`;
        const response = await this.fetchResponse(fileUrl, {
            method: "GET",
            headers,
            signal,
        });
        const content = await response.arrayBuffer();

        return Buffer.from(content);
    }

    private parseGitHubRepoData(repoUrl: string): GitHubRepositoryData {
        let url: URL;

        try {
            url = new URL(repoUrl.trim());
        } catch {
            throw new Error("Неверный URL репозитория GitHub");
        }

        const pathSegments = url.pathname
            .replace(/^\/+|\/+$/g, "")
            .replace(/\.git$/i, "")
            .split("/")
            .filter(Boolean);

        const owner = pathSegments[0];
        const repo = pathSegments[1];

        if (!owner || !repo) {
            throw new Error("Не удалось определить owner/repo для GitHub");
        }

        const hostname = url.hostname.toLowerCase();
        const apiBaseUrl =
            hostname === "github.com" || hostname === "www.github.com"
                ? "https://api.github.com"
                : `${url.protocol}//${url.host}/api/v3`;

        return {
            apiBaseUrl,
            repoPath: `${owner}/${repo}`,
        };
    }

    private parseGitLabRepoData(repoUrl: string): GitLabRepositoryData {
        let url: URL;

        try {
            url = new URL(repoUrl.trim());
        } catch {
            throw new Error("Неверный URL репозитория GitLab");
        }

        const normalizedPath = url.pathname
            .replace(/^\/+|\/+$/g, "")
            .split("/-/")[0]
            .replace(/\.git$/i, "");

        if (!normalizedPath || normalizedPath.split("/").length < 2) {
            throw new Error("Не удалось определить путь репозитория GitLab");
        }

        return {
            origin: `${url.protocol}//${url.host}`,
            repoPath: normalizedPath,
        };
    }

    private createGitHubHeaders(token: string | undefined) {
        const headers: Record<string, string> = {
            Accept: "application/vnd.github+json",
            "User-Agent": "zvs-assistant-desktop",
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    private createGitLabHeaders(token: string | undefined) {
        const headers: Record<string, string> = {};

        if (token) {
            headers["PRIVATE-TOKEN"] = token;
        }

        return headers;
    }

    private throwIfAborted(signal: AbortSignal): void {
        if (!signal.aborted) {
            return;
        }

        throw new DOMException("Aborted", "AbortError");
    }

    private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
        const response = await this.fetchResponse(url, init);
        return (await response.json()) as T;
    }

    private async fetchResponse(
        url: string,
        init: RequestInit,
    ): Promise<Response> {
        const response = await fetch(url, init);

        if (response.ok) {
            return response;
        }

        const responseBody = await response.text();
        const errorBody = responseBody.trim();

        throw new Error(
            errorBody
                ? `HTTP ${response.status} ${response.statusText}: ${errorBody}`
                : `HTTP ${response.status} ${response.statusText}`,
        );
    }
}
