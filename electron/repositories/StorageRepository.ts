import fs from "node:fs";
import path from "node:path";
import type {
    AddStorageFileDto,
    CreateStorageVecstoreDto,
    CreateStorageFolderDto,
    StorageFileEntity,
    StorageFolderEntity,
    StorageVecstoreEntity,
} from "../models/storage";
import {
    createStorageFileId,
    createStorageVecstoreId,
} from "../../src/utils/creators";
import type { StorageFoldersRepository } from "./storage/StorageFoldersRepository";
import type {
    StorageFileRecordPayload,
    StorageFilesRepository,
} from "./storage/StorageFilesRepository";
import type { StorageVecstoresRepository } from "./storage/StorageVecstoresRepository";

export class StorageRepository {
    constructor(
        private readonly storageRootPath: string,
        private readonly storageFoldersRepository: StorageFoldersRepository,
        private readonly storageFilesRepository: StorageFilesRepository,
        private readonly storageVecstoresRepository: StorageVecstoresRepository,
    ) {}

    findAll(): StorageFolderEntity[] {
        return this.storageFoldersRepository.findAll();
    }

    findAllFiles(): StorageFileEntity[] {
        return this.storageFilesRepository.findAll();
    }

    findAllVecstores(): StorageVecstoreEntity[] {
        return this.storageVecstoresRepository.findAll();
    }

    findFilesByFolderId(folderId: string): StorageFileEntity[] {
        return this.storageFilesRepository.findByFolderId(folderId);
    }

    findVectorizedFilesByFolderId(folderId: string): StorageFileEntity[] {
        return this.storageFilesRepository.findVectorizedByFolderId(folderId);
    }

    findNonVectorizedFilesByFolderId(folderId: string): StorageFileEntity[] {
        return this.storageFilesRepository.findNonVectorizedByFolderId(
            folderId,
        );
    }

    findFolderByName(name: string): StorageFolderEntity | null {
        const normalizedName = name.trim();

        if (!normalizedName) {
            return null;
        }

        return this.storageFoldersRepository.findByName(normalizedName);
    }

    createStorageFolder(payload: CreateStorageFolderDto): StorageFolderEntity {
        const now = new Date().toISOString();
        const normalizedPath = path.normalize(
            path.join(this.storageRootPath, payload.id),
        );

        if (!fs.existsSync(normalizedPath)) {
            fs.mkdirSync(normalizedPath, { recursive: true });
        }

        this.storageFoldersRepository.create({
            id: payload.id,
            name: payload.name.trim(),
            path: normalizedPath,
            size: this.calculateFolderSizeMb(normalizedPath),
            created_at: now,
            updated_at: now,
        });

        const created = this.findById(payload.id);

        if (!created) {
            throw new Error("Failed to create storage folder");
        }

        return created;
    }

    renameStorageFolder(id: string, name: string): StorageFolderEntity | null {
        const now = new Date().toISOString();

        this.storageFoldersRepository.rename(id, name.trim(), now);

        return this.findById(id);
    }

    addFilesToFolder(
        folderId: string,
        files: AddStorageFileDto[],
    ): StorageFileEntity[] {
        const folder = this.findById(folderId);

        if (!folder) {
            return [];
        }

        if (!fs.existsSync(folder.path)) {
            fs.mkdirSync(folder.path, { recursive: true });
        }

        const now = new Date().toISOString();

        const createdIds: string[] = [];
        const records: StorageFileRecordPayload[] = [];

        for (const file of files) {
            const sourcePath = file.path.trim();
            const normalizedSourcePath = sourcePath
                ? path.normalize(sourcePath)
                : "";
            const sourceName = file.name.trim() || path.basename(sourcePath);
            const targetPath = this.resolveUniqueTargetPath(
                folder.path,
                sourceName,
            );

            if (normalizedSourcePath && fs.existsSync(normalizedSourcePath)) {
                const sourceStats = fs.statSync(normalizedSourcePath);

                if (!sourceStats.isFile()) {
                    continue;
                }

                fs.copyFileSync(normalizedSourcePath, targetPath);
            } else if (file.contentBase64) {
                fs.writeFileSync(
                    targetPath,
                    Buffer.from(file.contentBase64, "base64"),
                );
            } else {
                continue;
            }

            const targetStats = fs.statSync(targetPath);

            records.push({
                id: file.id,
                folder_id: folderId,
                vecstore_id: null,
                name: path.relative(folder.path, targetPath) || sourceName,
                path: targetPath,
                size: this.bytesToMb(targetStats.size),
                created_at: now,
                updated_at: now,
            });

            createdIds.push(file.id);
        }

        this.storageFilesRepository.insertMany(records);

        this.recalculateFolderSize(folderId);

        if (createdIds.length === 0) {
            return [];
        }

        return this.storageFilesRepository.findByIds(createdIds);
    }

    createStorageVecstore(
        payload: CreateStorageVecstoreDto,
    ): StorageVecstoreEntity {
        const folder = this.findById(payload.folder_id);

        if (!folder) {
            throw new Error("Storage folder is not found");
        }

        if (folder.vecstore_id) {
            throw new Error("Folder already linked to vecstore");
        }

        const now = new Date().toISOString();
        const vecstoreId = createStorageVecstoreId();
        const vecstorePath = path.normalize(
            path.join(this.storageRootPath, vecstoreId),
        );

        if (!fs.existsSync(vecstorePath)) {
            fs.mkdirSync(vecstorePath, { recursive: true });
        }

        this.storageVecstoresRepository.create({
            id: vecstoreId,
            name: payload.name.trim(),
            folder_id: folder.id,
            description: payload.description?.trim() ?? "",
            path: vecstorePath,
            size: 0,
            entities_count: 0,
            created_at: now,
            updated_at: now,
        });

        this.storageFoldersRepository.updateLinkedVecstore(
            folder.id,
            vecstoreId,
            now,
        );

        const created = this.findVecstoreById(vecstoreId);

        if (!created) {
            throw new Error("Failed to create storage vecstore");
        }

        return created;
    }

    renameStorageVecstore(
        id: string,
        name: string,
    ): StorageVecstoreEntity | null {
        const now = new Date().toISOString();

        this.storageVecstoresRepository.rename(id, name.trim(), now);

        return this.findVecstoreById(id);
    }

    deleteStorageVecstore(id: string): void {
        const vecstore = this.findVecstoreById(id);

        if (vecstore) {
            const resolvedRootPath = path.resolve(this.storageRootPath);
            const resolvedVecstorePath = path.resolve(vecstore.path);
            const rootWithSeparator = resolvedRootPath.endsWith(path.sep)
                ? resolvedRootPath
                : `${resolvedRootPath}${path.sep}`;
            const vecstorePathLower = resolvedVecstorePath.toLowerCase();
            const rootPathLower = rootWithSeparator.toLowerCase();

            if (!vecstorePathLower.startsWith(rootPathLower)) {
                throw new Error(
                    "Storage vecstore path is outside storage root",
                );
            }

            if (fs.existsSync(resolvedVecstorePath)) {
                fs.rmSync(resolvedVecstorePath, {
                    recursive: true,
                    force: true,
                });
            }
        }

        const now = new Date().toISOString();

        this.storageFoldersRepository.clearLinkedVecstoreByVecstoreId(id, now);
        this.storageFilesRepository.clearVecstoreByVecstoreId(id);
        this.storageVecstoresRepository.deleteById(id);
    }

    refreshFolderContent(folderId: string): StorageFileEntity[] {
        const folder = this.findById(folderId);

        if (!folder) {
            return [];
        }

        if (!fs.existsSync(folder.path)) {
            fs.mkdirSync(folder.path, { recursive: true });
        }

        const files = this.collectFolderFiles(folder.path);
        const now = new Date().toISOString();
        const records: StorageFileRecordPayload[] = files.map((file) => ({
            id: file.id,
            folder_id: folderId,
            vecstore_id: null,
            name: file.name,
            path: file.path,
            size: file.size,
            created_at: now,
            updated_at: now,
        }));

        this.storageFilesRepository.replaceFolderFiles(folderId, records);
        this.recalculateFolderSize(folderId);

        return this.findFilesByFolderId(folderId);
    }

    refreshVecstoreById(id: string): StorageVecstoreEntity | null {
        const vecstore = this.findVecstoreById(id);

        if (!vecstore) {
            return null;
        }

        const metrics = this.storageFilesRepository.getVecstoreMetrics(id);

        this.storageVecstoresRepository.updateMetrics(
            id,
            metrics.total_size,
            metrics.entities_count,
            new Date().toISOString(),
        );

        return this.findVecstoreById(id);
    }

    refreshAllVecstores(): StorageVecstoreEntity[] {
        const vecstoreIds = this.storageVecstoresRepository.findIds();

        for (const vecstoreId of vecstoreIds) {
            this.refreshVecstoreById(vecstoreId);
        }

        return this.findAllVecstores();
    }

    removeFilesFromFolder(folderId: string, fileIds: string[]): void {
        if (fileIds.length === 0) {
            return;
        }

        this.storageFilesRepository.deleteByFolderAndIds(folderId, fileIds);

        this.recalculateFolderSize(folderId);
    }

    deleteStorageFolder(id: string): void {
        const folder = this.findById(id);

        const linkedVecstores =
            this.storageVecstoresRepository.findByFolderId(id);

        for (const vecstore of linkedVecstores) {
            const resolvedRootPath = path.resolve(this.storageRootPath);
            const resolvedVecstorePath = path.resolve(vecstore.path);
            const rootWithSeparator = resolvedRootPath.endsWith(path.sep)
                ? resolvedRootPath
                : `${resolvedRootPath}${path.sep}`;
            const vecstorePathLower = resolvedVecstorePath.toLowerCase();
            const rootPathLower = rootWithSeparator.toLowerCase();

            if (!vecstorePathLower.startsWith(rootPathLower)) {
                throw new Error(
                    "Storage vecstore path is outside storage root",
                );
            }

            if (fs.existsSync(resolvedVecstorePath)) {
                fs.rmSync(resolvedVecstorePath, {
                    recursive: true,
                    force: true,
                });
            }
        }

        if (folder) {
            const resolvedRootPath = path.resolve(this.storageRootPath);
            const resolvedFolderPath = path.resolve(folder.path);
            const rootWithSeparator = resolvedRootPath.endsWith(path.sep)
                ? resolvedRootPath
                : `${resolvedRootPath}${path.sep}`;
            const folderPathLower = resolvedFolderPath.toLowerCase();
            const rootPathLower = rootWithSeparator.toLowerCase();

            if (!folderPathLower.startsWith(rootPathLower)) {
                throw new Error("Storage folder path is outside storage root");
            }

            if (fs.existsSync(resolvedFolderPath)) {
                fs.rmSync(resolvedFolderPath, {
                    recursive: true,
                    force: true,
                });
            }
        }

        this.storageFoldersRepository.deleteById(id);
    }

    private findById(id: string): StorageFolderEntity | null {
        return this.storageFoldersRepository.findById(id);
    }

    private findVecstoreById(id: string): StorageVecstoreEntity | null {
        return this.storageVecstoresRepository.findById(id);
    }

    private recalculateFolderSize(folderId: string): void {
        const totalSize =
            this.storageFilesRepository.sumSizeByFolderId(folderId);

        this.storageFoldersRepository.updateSize(
            folderId,
            totalSize,
            new Date().toISOString(),
        );
    }

    private resolveUniqueTargetPath(
        folderPath: string,
        fileName: string,
    ): string {
        const parsed = path.parse(fileName);
        const safeName = parsed.name || "file";
        const extension = parsed.ext;
        let candidate = path.join(folderPath, `${safeName}${extension}`);
        let index = 1;

        while (fs.existsSync(candidate)) {
            candidate = path.join(
                folderPath,
                `${safeName} (${index})${extension}`,
            );
            index += 1;
        }

        return path.normalize(candidate);
    }

    private collectFolderFiles(rootPath: string): AddStorageFileDto[] {
        const result: AddStorageFileDto[] = [];
        const walk = (currentPath: string) => {
            const entries = fs.readdirSync(currentPath, {
                withFileTypes: true,
            });

            for (const entry of entries) {
                const absolutePath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    walk(absolutePath);
                    continue;
                }

                if (!entry.isFile()) {
                    continue;
                }

                const stats = fs.statSync(absolutePath);
                const relativeName = path
                    .relative(rootPath, absolutePath)
                    .split(path.sep)
                    .join("/");

                result.push({
                    id: createStorageFileId(relativeName),
                    name: relativeName,
                    path: path.normalize(absolutePath),
                    size: this.bytesToMb(stats.size),
                });
            }
        };

        walk(rootPath);

        return result;
    }

    private bytesToMb(sizeInBytes: number): number {
        return Number((sizeInBytes / (1024 * 1024)).toFixed(4));
    }

    private calculateFolderSizeMb(targetPath: string): number {
        try {
            const bytes = this.calculateFolderSizeBytes(targetPath);
            return Number((bytes / (1024 * 1024)).toFixed(2));
        } catch {
            return 0;
        }
    }

    private calculateFolderSizeBytes(targetPath: string): number {
        if (!fs.existsSync(targetPath)) {
            return 0;
        }

        const stats = fs.statSync(targetPath);

        if (!stats.isDirectory()) {
            return stats.size;
        }

        const entries = fs.readdirSync(targetPath, { withFileTypes: true });

        return entries.reduce((total, entry) => {
            const entryPath = path.join(targetPath, entry.name);

            if (entry.isDirectory()) {
                return total + this.calculateFolderSizeBytes(entryPath);
            }

            if (entry.isFile()) {
                return total + fs.statSync(entryPath).size;
            }

            return total;
        }, 0);
    }
}
