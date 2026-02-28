import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { UserDataService } from "../UserDataService";
import { LanceDbService } from "./LanceDbService";
import { OllamaService } from "../agents/OllamaService";
import { attemptOrNull, raiseBusinessError } from "../errors/errorPattern";
import type { CreateJobPayload } from "../../../src/types/ElectronApi";
import type {
    LanceVectorRow,
    VectorizationCallbacks,
    VectorizationChunk,
    VectorizationDocument,
    VectorizationSourceFile,
} from "../../../src/types/Storage";

const SUPPORTED_FILE_EXTENSIONS = new Set([".pdf", ".docx"]);
const CHUNK_SIZE = 1200;
const MAX_BATCH_SIZE = 24;

export class VectorizationService {
    constructor(
        private readonly userDataService: UserDataService,
        private readonly ollamaService: OllamaService,
        private readonly lanceDbService: LanceDbService,
    ) {}

    async runVectorizationJob(
        payload: CreateJobPayload,
        signal: AbortSignal,
        callbacks: VectorizationCallbacks,
    ): Promise<{ totalFiles: number }> {
        const vectorStorageId = payload.vectorStorageId?.trim();

        if (!vectorStorageId) {
            raiseBusinessError(
                "VECTOR_STORAGE_ID_EMPTY",
                "Не передан идентификатор векторного хранилища",
            );
        }

        const storage =
            this.userDataService.getVectorStorageById(vectorStorageId);

        if (!storage) {
            raiseBusinessError(
                "VECTOR_STORAGE_NOT_FOUND",
                "Векторное хранилище не найдено",
            );
        }

        const activeDataPath =
            storage.dataPath.trim() ||
            this.lanceDbService.getDefaultDataPath(vectorStorageId);

        this.throwIfAborted(signal);

        callbacks.onStage("Стадия подготовки файлов начата", "info");
        const preparedFiles = await this.prepareFiles(payload, callbacks);
        callbacks.onStage(
            `Подготовка завершена. Файлов к обработке: ${preparedFiles.length}`,
            "success",
        );

        this.throwIfAborted(signal);

        callbacks.onStage("Стадия чтения файлов начата", "info");
        const documents = await this.readSupportedDocuments(
            preparedFiles,
            signal,
            callbacks,
        );
        callbacks.onStage(
            `Чтение завершено. Документов: ${documents.length}`,
            "success",
        );

        this.throwIfAborted(signal);

        callbacks.onStage("Стадия эмбеддинга начата", "info");
        const embeddedRows = await this.embedDocuments(
            documents,
            vectorStorageId,
            signal,
            callbacks,
        );
        callbacks.onStage(
            `Эмбеддинг завершён. Векторов: ${embeddedRows.length}`,
            "success",
        );

        this.throwIfAborted(signal);

        callbacks.onStage("Стадия индексации в LanceDB начата", "info");
        callbacks.onStage(
            `Передача ${embeddedRows.length} векторов в индекс LanceDB`,
            "info",
        );
        await this.lanceDbService.addVectors(activeDataPath, embeddedRows);
        callbacks.onStage("Индексация в LanceDB завершена", "success");

        this.throwIfAborted(signal);

        const existingFileIds = storage.fileIds ?? [];
        const preparedPersistedFileIds = preparedFiles
            .map((file) => file.persistedFileId)
            .filter((fileId): fileId is string => Boolean(fileId));
        const uniqueFileIds = [
            ...new Set([...existingFileIds, ...preparedPersistedFileIds]),
        ];
        const vectorStorageSizeBytes =
            await this.lanceDbService.getDataPathSizeBytes(activeDataPath);
        await this.userDataService.updateVectorStorage(vectorStorageId, {
            fileIds: uniqueFileIds,
            size: vectorStorageSizeBytes,
            dataPath: activeDataPath,
            lastActiveAt: new Date().toISOString(),
        });

        callbacks.onStage("Пайплайн векторизации завершён", "success");

        return {
            totalFiles: uniqueFileIds.length,
        };
    }

    private async prepareFiles(
        payload: CreateJobPayload,
        callbacks: VectorizationCallbacks,
    ): Promise<VectorizationSourceFile[]> {
        const sourceFileIds = Array.isArray(payload.sourceFileIds)
            ? payload.sourceFileIds
            : [];
        const existingFiles = this.userDataService.getFilesByIds(sourceFileIds);
        callbacks.onStage(
            `Файлов из хранилища получено: ${existingFiles.length}`,
            "info",
        );

        const uploadedFiles = Array.isArray(payload.uploadedFiles)
            ? payload.uploadedFiles
            : [];
        callbacks.onStage(
            `Файлов из проводника получено: ${uploadedFiles.length}`,
            "info",
        );
        const savedFromUploads = uploadedFiles.length
            ? this.userDataService.saveFiles(uploadedFiles)
            : [];

        if (savedFromUploads.length) {
            callbacks.onStage(
                `Сохранено новых файлов в files: ${savedFromUploads.length}`,
                "success",
            );
        }

        const sourceDirectoryPath =
            typeof payload.sourceDirectoryPath === "string"
                ? payload.sourceDirectoryPath.trim()
                : "";
        const filesFromDirectory = sourceDirectoryPath
            ? await this.collectSupportedFilesFromDirectory(
                  sourceDirectoryPath,
                  callbacks,
              )
            : [];

        if (filesFromDirectory.length) {
            callbacks.onStage(
                `Файлов из папки данных получено: ${filesFromDirectory.length}`,
                "info",
            );
        }

        const preparedFromStorage = existingFiles.map((file) => ({
            id: file.id,
            path: file.path,
            originalName: file.originalName,
            size: file.size,
            persistedFileId: file.id,
        }));

        const preparedFromUploads = savedFromUploads.map((file) => ({
            id: file.id,
            path: file.path,
            originalName: file.originalName,
            size: file.size,
            persistedFileId: file.id,
        }));

        const merged = [
            ...preparedFromStorage,
            ...preparedFromUploads,
            ...filesFromDirectory,
        ];

        if (!merged.length) {
            throw new Error(
                "Не выбраны файлы для векторизации и не задана папка данных",
            );
        }

        const deduplicated = new Map<string, VectorizationSourceFile>();
        for (const file of merged) {
            const dedupeKey = `${file.path.toLowerCase()}::${file.persistedFileId || ""}`;
            deduplicated.set(dedupeKey, file);
        }

        const validated = [...deduplicated.values()];

        if (!validated.length) {
            throw new Error("Не найдены файлы для обработки");
        }

        return validated;
    }

    private async readSupportedDocuments(
        files: VectorizationSourceFile[],
        signal: AbortSignal,
        callbacks: VectorizationCallbacks,
    ): Promise<VectorizationDocument[]> {
        const documents: VectorizationDocument[] = [];

        for (const file of files) {
            this.throwIfAborted(signal);

            const extension = path.extname(file.originalName).toLowerCase();

            callbacks.onStage(
                `Чтение файла: ${file.originalName} (${extension || "без расширения"})`,
                "info",
            );

            if (!SUPPORTED_FILE_EXTENSIONS.has(extension)) {
                callbacks.onStage(
                    `Файл ${file.originalName} пропущен: поддерживаются только PDF/DOCX`,
                    "warning",
                );
                continue;
            }

            const buffer = await fs.readFile(file.path);

            let rawText = "";

            if (extension === ".pdf") {
                const parser = new PDFParse({ data: buffer });
                const parsed = await parser.getText();
                rawText = parsed.text || "";
                await parser.destroy();
            } else if (extension === ".docx") {
                const parsed = await mammoth.extractRawText({ buffer });
                rawText = parsed.value || "";
            }

            const normalizedText = rawText.replace(/\s+/g, " ").trim();

            if (!normalizedText) {
                callbacks.onStage(
                    `Файл ${file.originalName} не содержит извлекаемого текста`,
                    "warning",
                );
                continue;
            }

            callbacks.onStage(
                `Текст из ${file.originalName} успешно извлечён`,
                "success",
            );

            documents.push({
                fileId: this.resolveDocumentFileId(file),
                fileName: file.originalName,
                text: normalizedText,
            });
        }

        if (!documents.length) {
            raiseBusinessError(
                "VECTORIZATION_TEXT_NOT_EXTRACTED",
                "Не удалось извлечь текст из выбранных файлов",
            );
        }

        return documents;
    }

    private async collectSupportedFilesFromDirectory(
        directoryPath: string,
        callbacks: VectorizationCallbacks,
    ): Promise<VectorizationSourceFile[]> {
        const rootStats = await attemptOrNull(() => fs.stat(directoryPath));

        if (!rootStats) {
            raiseBusinessError(
                "VECTORIZATION_DIRECTORY_UNAVAILABLE",
                "Папка данных для индексации недоступна",
            );
        }

        if (!rootStats.isDirectory()) {
            raiseBusinessError(
                "VECTORIZATION_DIRECTORY_REQUIRED",
                "Путь данных должен указывать на папку",
            );
        }

        callbacks.onStage(`Сканирую папку данных: ${directoryPath}`, "info");

        const collected: VectorizationSourceFile[] = [];

        const walk = async (currentDirectory: string): Promise<void> => {
            const entries = await fs.readdir(currentDirectory, {
                withFileTypes: true,
            });

            for (const entry of entries) {
                const fullPath = path.join(currentDirectory, entry.name);

                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }

                if (!entry.isFile()) {
                    continue;
                }

                const extension = path.extname(entry.name).toLowerCase();

                if (!SUPPORTED_FILE_EXTENSIONS.has(extension)) {
                    continue;
                }

                const fileStats = await fs.stat(fullPath);

                collected.push({
                    id: `dir_${randomUUID().replace(/-/g, "")}`,
                    path: fullPath,
                    originalName: entry.name,
                    size: fileStats.size,
                });
            }
        };

        await walk(directoryPath);

        return collected;
    }

    private resolveDocumentFileId(file: VectorizationSourceFile): string {
        if (typeof file.persistedFileId === "string" && file.persistedFileId) {
            return file.persistedFileId;
        }

        return `path:${file.path}`;
    }

    private async embedDocuments(
        documents: VectorizationDocument[],
        vectorStorageId: string,
        signal: AbortSignal,
        callbacks: VectorizationCallbacks,
    ) {
        const profile = this.userDataService.getBootData().userProfile;

        if (profile.embeddingDriver !== "ollama") {
            raiseBusinessError(
                "EMBEDDING_DRIVER_NOT_OLLAMA",
                "Для векторизации нужно включить настройку 'Использовать для создания эмбеддингов' в Ollama",
            );
        }

        const model =
            profile.ollamaEmbeddingModel.trim() || profile.ollamaModel.trim();

        if (!model) {
            raiseBusinessError(
                "EMBEDDING_MODEL_EMPTY",
                "Не выбрана Ollama эмбеддинг-модель",
            );
        }

        const token = profile.ollamaToken;

        const chunks: VectorizationChunk[] = [];

        for (const document of documents) {
            const documentChunks = this.chunkText(document.text, CHUNK_SIZE);

            callbacks.onStage(
                `Файл ${document.fileName}: подготовлено чанков ${documentChunks.length}`,
                "info",
            );

            for (let index = 0; index < documentChunks.length; index += 1) {
                chunks.push({
                    id: `chunk_${randomUUID().replace(/-/g, "")}`,
                    text: documentChunks[index],
                    fileId: document.fileId,
                    fileName: document.fileName,
                    chunkIndex: index,
                });
            }
        }

        callbacks.onStage(
            `Всего чанков для эмбеддинга: ${chunks.length}`,
            "info",
        );

        const rows: LanceVectorRow[] = [];

        for (let offset = 0; offset < chunks.length; offset += MAX_BATCH_SIZE) {
            this.throwIfAborted(signal);

            const batch = chunks.slice(offset, offset + MAX_BATCH_SIZE);
            const batchTexts = batch.map((chunk) => chunk.text);
            const processedBefore = offset;
            const processedAfter = Math.min(
                offset + batch.length,
                chunks.length,
            );
            const progressPercent = Math.round(
                (processedAfter / chunks.length) * 100,
            );

            callbacks.onStage(
                `Эмбеддинг батча: ${processedBefore + 1}-${processedAfter}/${chunks.length} (${progressPercent}%)`,
                "info",
            );

            const embedResult = await this.ollamaService.getEmbed(
                {
                    model,
                    input: batchTexts,
                },
                token,
            );

            if (embedResult.embeddings.length !== batch.length) {
                raiseBusinessError(
                    "EMBEDDING_BATCH_MISMATCH",
                    "Количество эмбеддингов не совпадает с размером батча",
                );
            }

            for (let index = 0; index < batch.length; index += 1) {
                rows.push({
                    id: batch[index].id,
                    vector: embedResult.embeddings[index],
                    text: batch[index].text,
                    fileId: batch[index].fileId,
                    fileName: batch[index].fileName,
                    chunkIndex: batch[index].chunkIndex,
                    vectorStorageId,
                    createdAt: new Date().toISOString(),
                });
            }
        }

        return rows;
    }

    private chunkText(text: string, chunkSize: number): string[] {
        if (!text) {
            return [];
        }

        const chunks: string[] = [];
        let offset = 0;

        while (offset < text.length) {
            const slice = text.slice(offset, offset + chunkSize).trim();

            if (slice) {
                chunks.push(slice);
            }

            offset += chunkSize;
        }

        return chunks;
    }

    private throwIfAborted(signal: AbortSignal): void {
        if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }
    }
}
