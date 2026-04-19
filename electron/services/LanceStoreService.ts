import fs from "node:fs";
import path from "node:path";
import type {
    StorageFileEntity,
    StorageVecstoreEntity,
} from "../models/storage";
import type { ChatGenService } from "./ChatGenService";

type LanceChunkRecord = {
    id: string;
    file_id: string;
    file_path: string;
    chunk_index: number;
    content: string;
    vector: number[];
    created_at: string;
};

type FileProcessingStatus = "indexed" | "skipped" | "failed";

type FileProcessingProgress = {
    processed: number;
    total: number;
    fileId: string;
    fileName: string;
    status: FileProcessingStatus;
    reason?: string;
};

type IndexingOptions = {
    onFileProgress?: (progress: FileProcessingProgress) => void;
};

export type LanceIndexingResult = {
    indexedFileIds: string[];
    skippedFileIds: string[];
    failedFileIds: string[];
    indexedChunks: number;
};

type BuildRowsResult = LanceIndexingResult & {
    rows: LanceChunkRecord[];
};

type BuildRowsForFileResult = {
    rows: LanceChunkRecord[];
    status: FileProcessingStatus;
    reason?: string;
};

type LanceDbConnection = {
    createTable?: (
        name: string,
        data: LanceChunkRecord[],
        options?: Record<string, unknown>,
    ) => Promise<unknown>;
    openTable?: (name: string) => Promise<LanceTableConnection>;
};

type LanceTableConnection = {
    add?: (data: LanceChunkRecord[]) => Promise<void>;
};

const SUPPORTED_TEXT_EXTENSIONS = new Set([
    ".txt",
    ".md",
    ".mdx",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".csv",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".php",
    ".rb",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".css",
    ".scss",
    ".less",
    ".html",
    ".sql",
    ".sh",
    ".env",
    ".ini",
]);

export class LanceStoreService {
    private readonly maxFileSizeBytes = 5 * 1024 * 1024;
    private readonly chunkSize = 1200;
    private readonly chunkOverlap = 200;
    private readonly maxParallelFileWorkers = this.resolveMaxParallelWorkers();

    constructor(
        private readonly chatGenService: Pick<
            ChatGenService,
            "createEmbedding" | "createEmbeddings"
        >,
    ) {}

    async initializeVecstore(
        vecstore: StorageVecstoreEntity,
        files: StorageFileEntity[],
        options?: IndexingOptions,
    ): Promise<LanceIndexingResult> {
        this.ensureVecstoreDirectory(vecstore.path);

        const buildResult = await this.buildChunkRows(files, options);
        const db = await this.connect(vecstore.path);

        if (buildResult.rows.length > 0) {
            await this.createTable(db, buildResult.rows, true);
        }

        this.writeManifest(vecstore.path, vecstore.id, buildResult);

        return {
            indexedFileIds: buildResult.indexedFileIds,
            skippedFileIds: buildResult.skippedFileIds,
            failedFileIds: buildResult.failedFileIds,
            indexedChunks: buildResult.indexedChunks,
        };
    }

    async appendFilesToVecstore(
        vecstore: StorageVecstoreEntity,
        files: StorageFileEntity[],
        options?: IndexingOptions,
    ): Promise<LanceIndexingResult> {
        this.ensureVecstoreDirectory(vecstore.path);

        const buildResult = await this.buildChunkRows(files, options);

        if (buildResult.rows.length > 0) {
            const db = await this.connect(vecstore.path);
            await this.appendRows(db, buildResult.rows);
        }

        this.writeManifest(vecstore.path, vecstore.id, buildResult);

        return {
            indexedFileIds: buildResult.indexedFileIds,
            skippedFileIds: buildResult.skippedFileIds,
            failedFileIds: buildResult.failedFileIds,
            indexedChunks: buildResult.indexedChunks,
        };
    }

    private async buildChunkRows(
        files: StorageFileEntity[],
        options?: IndexingOptions,
    ): Promise<BuildRowsResult> {
        if (files.length === 0) {
            return {
                rows: [],
                indexedFileIds: [],
                skippedFileIds: [],
                failedFileIds: [],
                indexedChunks: 0,
            };
        }

        const now = new Date().toISOString();
        const total = files.length;
        const maxWorkers = Math.min(this.maxParallelFileWorkers, total);
        const resultsByIndex: Array<{
            file: StorageFileEntity;
            result: BuildRowsForFileResult;
        }> = new Array(total);

        let nextFileIndex = 0;
        let processedFiles = 0;

        const runWorker = async () => {
            while (nextFileIndex < total) {
                const currentIndex = nextFileIndex;
                nextFileIndex += 1;

                const file = files[currentIndex];
                const result = await this.buildRowsForFile(file, now);
                resultsByIndex[currentIndex] = {
                    file,
                    result,
                };

                processedFiles += 1;

                options?.onFileProgress?.({
                    processed: processedFiles,
                    total,
                    fileId: file.id,
                    fileName: file.name,
                    status: result.status,
                    reason: result.reason,
                });
            }
        };

        await Promise.all(
            Array.from({ length: maxWorkers }, async () => runWorker()),
        );

        const rows: LanceChunkRecord[] = [];
        const indexedFileIds: string[] = [];
        const skippedFileIds: string[] = [];
        const failedFileIds: string[] = [];

        for (const item of resultsByIndex) {
            const file = item.file;
            const fileResult = item.result;

            rows.push(...fileResult.rows);

            if (fileResult.status === "indexed") {
                indexedFileIds.push(file.id);
            } else if (fileResult.status === "skipped") {
                skippedFileIds.push(file.id);
            } else {
                failedFileIds.push(file.id);
            }
        }

        return {
            rows,
            indexedFileIds,
            skippedFileIds,
            failedFileIds,
            indexedChunks: rows.length,
        };
    }

    private async buildRowsForFile(
        file: StorageFileEntity,
        createdAt: string,
    ): Promise<BuildRowsForFileResult> {
        if (!this.isSupportedTextFile(file.path)) {
            return {
                rows: [],
                status: "skipped",
                reason: "Неподдерживаемый формат файла",
            };
        }

        if (!fs.existsSync(file.path)) {
            return {
                rows: [],
                status: "skipped",
                reason: "Файл не найден на диске",
            };
        }

        const stats = fs.statSync(file.path);

        if (!stats.isFile()) {
            return {
                rows: [],
                status: "skipped",
                reason: "Объект не является файлом",
            };
        }

        if (stats.size > this.maxFileSizeBytes) {
            return {
                rows: [],
                status: "skipped",
                reason: "Файл слишком большой для индексации",
            };
        }

        const text = this.safeReadUtf8(file.path);

        if (!text) {
            return {
                rows: [],
                status: "skipped",
                reason: "Не удалось прочитать содержимое файла",
            };
        }

        const chunks = this.splitIntoChunks(text);

        if (chunks.length === 0) {
            return {
                rows: [],
                status: "skipped",
                reason: "Файл не содержит текстовых данных",
            };
        }

        try {
            const vectors = await this.chatGenService.createEmbeddings(chunks);

            if (vectors.length !== chunks.length) {
                return {
                    rows: [],
                    status: "failed",
                    reason: "Провайдер вернул неполный набор эмбеддингов",
                };
            }

            return {
                rows: chunks.map((content, chunkIndex) => ({
                    id: `${file.id}:${chunkIndex}`,
                    file_id: file.id,
                    file_path: file.path,
                    chunk_index: chunkIndex,
                    content,
                    vector: vectors[chunkIndex],
                    created_at: createdAt,
                })),
                status: "indexed",
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Неизвестная ошибка создания эмбеддингов";

            return {
                rows: [],
                status: "failed",
                reason: errorMessage,
            };
        }
    }

    private splitIntoChunks(text: string): string[] {
        const normalized = text.trim();

        if (!normalized) {
            return [];
        }

        if (normalized.length <= this.chunkSize) {
            return [normalized];
        }

        const chunks: string[] = [];
        let start = 0;

        while (start < normalized.length) {
            const end = Math.min(start + this.chunkSize, normalized.length);
            const chunk = normalized.slice(start, end).trim();

            if (chunk) {
                chunks.push(chunk);
            }

            if (end >= normalized.length) {
                break;
            }

            start = Math.max(end - this.chunkOverlap, 0);
        }

        return chunks;
    }

    private safeReadUtf8(filePath: string): string | null {
        try {
            return fs.readFileSync(filePath, "utf8");
        } catch {
            return null;
        }
    }

    private isSupportedTextFile(filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();

        if (!extension) {
            return true;
        }

        return SUPPORTED_TEXT_EXTENSIONS.has(extension);
    }

    private ensureVecstoreDirectory(vecstorePath: string): void {
        if (!fs.existsSync(vecstorePath)) {
            fs.mkdirSync(vecstorePath, { recursive: true });
        }
    }

    private async connect(vecstorePath: string): Promise<LanceDbConnection> {
        const lancedbModule = (await import("@lancedb/lancedb")) as {
            connect?: (uri: string) => Promise<unknown>;
            default?: { connect?: (uri: string) => Promise<unknown> };
        };

        const connect = lancedbModule.connect ?? lancedbModule.default?.connect;

        if (!connect) {
            throw new Error("LanceDB connect() is unavailable");
        }

        return (await connect(vecstorePath)) as LanceDbConnection;
    }

    private async createTable(
        db: LanceDbConnection,
        rows: LanceChunkRecord[],
        overwrite: boolean,
    ): Promise<void> {
        if (typeof db.createTable !== "function") {
            throw new Error("LanceDB createTable() is unavailable");
        }

        if (!overwrite) {
            await db.createTable("chunks", rows);
            return;
        }

        try {
            await db.createTable("chunks", rows, { mode: "overwrite" });
        } catch {
            await db.createTable("chunks", rows);
        }
    }

    private async appendRows(
        db: LanceDbConnection,
        rows: LanceChunkRecord[],
    ): Promise<void> {
        const table = await this.openTable(db, "chunks");

        if (!table) {
            await this.createTable(db, rows, false);
            return;
        }

        if (typeof table.add !== "function") {
            throw new Error("LanceDB table.add() is unavailable");
        }

        await table.add(rows);
    }

    private async openTable(
        db: LanceDbConnection,
        name: string,
    ): Promise<LanceTableConnection | null> {
        if (typeof db.openTable !== "function") {
            return null;
        }

        try {
            return await db.openTable(name);
        } catch {
            return null;
        }
    }

    private resolveMaxParallelWorkers(): number {
        const configured = Number.parseInt(
            process.env["ZVS_INDEXING_PARALLEL_FILES"] ?? "",
            10,
        );

        if (!Number.isFinite(configured) || configured <= 0) {
            return 3;
        }

        return Math.min(configured, 12);
    }

    private writeManifest(
        vecstorePath: string,
        vecstoreId: string,
        result: LanceIndexingResult,
    ): void {
        const manifestPath = path.join(vecstorePath, "zvs-lance-manifest.json");

        fs.writeFileSync(
            manifestPath,
            JSON.stringify(
                {
                    vecstoreId,
                    indexedFiles: result.indexedFileIds.length,
                    skippedFiles: result.skippedFileIds.length,
                    failedFiles: result.failedFileIds.length,
                    indexedChunks: result.indexedChunks,
                    updatedAt: new Date().toISOString(),
                },
                null,
                2,
            ),
            "utf8",
        );
    }
}
