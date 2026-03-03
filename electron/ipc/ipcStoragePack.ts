import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import type { DatabaseService } from "../services/storage/DatabaseService";
import type { FileStorageService } from "../services/storage/FileStorageService";
import type { UserProfileService } from "../services/userData/UserProfileService";
import type { LanceDbService } from "../services/storage/LanceDbService";
import type { OllamaService } from "../services/agents/OllamaService";
import type {
    AppCacheEntry,
    UpdateVectorStoragePayload,
    UploadedFileData,
} from "../../src/types/ElectronApi";
import { handleIpc, handleManyIpc } from "./ipcUtils";

export type IpcStoragePackDeps = {
    databaseService: DatabaseService;
    fileStorageService: FileStorageService;
    userProfileService: UserProfileService;
    lanceDbService: LanceDbService;
    ollamaService: OllamaService;
    vectorIndexPath: string;
};

export const registerIpcStoragePack = ({
    databaseService,
    fileStorageService,
    userProfileService,
    lanceDbService,
    ollamaService,
    vectorIndexPath,
}: IpcStoragePackDeps) => {
    const getCurrentUserId = () => userProfileService.getCurrentUserId();

    handleManyIpc([
        [
            "app:save-files",
            (files: UploadedFileData[]) => fileStorageService.saveFiles(files),
        ],
        [
            "app:get-files-by-ids",
            (fileIds: string[]) => fileStorageService.getFilesByIds(fileIds),
        ],
        ["app:get-all-files", () => fileStorageService.getAllFiles()],
        [
            "app:delete-file",
            (fileId: string) => fileStorageService.deleteFileById(fileId),
        ],
        [
            "app:get-vector-storages",
            () => databaseService.getVectorStorages(getCurrentUserId()),
        ],
        [
            "app:get-vector-tags",
            () => databaseService.getVectorTags(getCurrentUserId()),
        ],
        [
            "app:create-vector-tag",
            (name: string) =>
                databaseService.createVectorTag(getCurrentUserId(), name),
        ],
        [
            "app:delete-vector-storage",
            (vectorStorageId: string) =>
                databaseService.deleteVectorStorage(
                    vectorStorageId,
                    getCurrentUserId(),
                ),
        ],
        [
            "app:get-cache-entry",
            (key: string) =>
                databaseService.getCacheEntry(key) as AppCacheEntry | null,
        ],
        [
            "app:set-cache-entry",
            (key: string, entry: AppCacheEntry) => {
                databaseService.setCacheEntry(key, entry);
            },
        ],
    ]);

    handleIpc("app:create-vector-storage", () => {
        const currentOwnerId = getCurrentUserId();
        const vectorStorageName = `store_${randomUUID().replace(/-/g, "")}`;
        const vectorStorageId = `vs_${randomUUID().replace(/-/g, "")}`;
        const defaultDataPath = path.join(
            vectorIndexPath,
            `${vectorStorageId}.lance`,
        );

        return databaseService.createVectorStorage(
            currentOwnerId,
            vectorStorageName,
            defaultDataPath,
            vectorStorageId,
        );
    });

    handleIpc(
        "app:update-vector-storage",
        async (
            vectorStorageId: string,
            payload: UpdateVectorStoragePayload,
        ) => {
            const normalizedDataPath =
                typeof payload.dataPath === "string"
                    ? payload.dataPath.trim()
                    : undefined;

            if (normalizedDataPath !== undefined) {
                const resolvedDataPathReference = normalizedDataPath
                    ? await lanceDbService.resolveDataPathReference(
                          normalizedDataPath,
                      )
                    : null;

                if (normalizedDataPath && !resolvedDataPathReference) {
                    throw new Error(
                        "Путь должен указывать на папку таблицы .lance или директорию с единственной таблицей .lance",
                    );
                }

                const effectiveDataPath = normalizedDataPath
                    ? resolvedDataPathReference!.dataPath
                    : "";

                const sizeFromDataPath = effectiveDataPath
                    ? await lanceDbService.getDataPathSizeBytes(
                          effectiveDataPath,
                      )
                    : 0;

                return databaseService.updateVectorStorage(
                    vectorStorageId,
                    {
                        ...payload,
                        dataPath: effectiveDataPath,
                        size: sizeFromDataPath,
                        lastActiveAt: new Date().toISOString(),
                    },
                    getCurrentUserId(),
                );
            }

            return databaseService.updateVectorStorage(
                vectorStorageId,
                payload,
                getCurrentUserId(),
            );
        },
    );

    handleIpc(
        "app:search-vector-storage",
        async (vectorStorageId: string, query: string, limit?: number) => {
            const normalizedStorageId =
                typeof vectorStorageId === "string"
                    ? vectorStorageId.trim()
                    : "";
            const normalizedQuery =
                typeof query === "string" ? query.trim() : "";

            if (!normalizedStorageId) {
                throw new Error("Не передан идентификатор vector storage");
            }

            if (!normalizedQuery) {
                throw new Error("Поисковый запрос пуст");
            }

            const storage = databaseService.getVectorStorageById(
                normalizedStorageId,
                getCurrentUserId(),
            );

            if (!storage) {
                throw new Error("Vector storage не найден");
            }

            const dataPath = storage.dataPath.trim();

            if (!dataPath) {
                throw new Error(
                    "Для векторного хранилища не задан путь к индексу",
                );
            }

            const profile = userProfileService.getUserProfile();
            const model =
                profile.ollamaEmbeddingModel.trim() ||
                profile.ollamaModel.trim();

            if (!model) {
                throw new Error("Не задана embedding model");
            }

            const embedResult = await ollamaService.getEmbed(
                {
                    model,
                    input: [normalizedQuery],
                },
                profile.ollamaToken,
            );

            const queryEmbedding =
                embedResult.embeddings[0] &&
                Array.isArray(embedResult.embeddings[0])
                    ? embedResult.embeddings[0]
                    : [];

            if (!queryEmbedding.length) {
                throw new Error("Не удалось получить embedding запроса");
            }

            const rows = await lanceDbService.search(
                dataPath,
                queryEmbedding,
                typeof limit === "number" ? limit : 5,
            );

            return rows.map((row) => ({
                id: row.id,
                text: row.text,
                fileId: row.fileId,
                fileName: row.fileName,
                chunkIndex: row.chunkIndex,
                score:
                    typeof row._distance === "number"
                        ? row._distance
                        : typeof row._score === "number"
                          ? row._score
                          : 0,
            }));
        },
    );

    handleIpc("app:fs-list-directory", async (cwd: string) => {
        const entries = await fs.readdir(cwd, { withFileTypes: true });
        const result = await Promise.all(
            entries.map(async (entry) => {
                const entryPath = path.join(cwd, entry.name);
                const stat = await fs.stat(entryPath);
                return {
                    name: entry.name,
                    type: entry.isDirectory() ? "directory" : "file",
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                };
            }),
        );
        return { path: cwd, entries: result };
    });

    handleIpc(
        "app:fs-create-file",
        async (cwd: string, filename: string, content: string = "") => {
            const filePath = path.join(cwd, filename);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, "utf-8");
            return { success: true, path: filePath };
        },
    );

    handleIpc("app:fs-create-dir", async (cwd: string, dirname: string) => {
        const dirPath = path.join(cwd, dirname);
        await fs.mkdir(dirPath, { recursive: true });
        return { success: true, path: dirPath };
    });

    handleIpc(
        "app:fs-read-file",
        async (
            filePath: string,
            readAll: boolean,
            fromLine?: number,
            toLine?: number,
        ) => {
            const raw = await fs.readFile(filePath, "utf-8");
            const lines = raw.split("\n");
            const totalLines = lines.length;

            if (readAll) {
                return {
                    path: filePath,
                    content: raw,
                    totalLines,
                    fromLine: 1,
                    toLine: totalLines,
                };
            }

            const from = Math.max(1, fromLine ?? 1);
            const to = Math.min(totalLines, toLine ?? totalLines);
            const content = lines.slice(from - 1, to).join("\n");

            return {
                path: filePath,
                content,
                totalLines,
                fromLine: from,
                toLine: to,
            };
        },
    );
};
