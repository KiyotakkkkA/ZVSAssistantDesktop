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
import type { DatabaseService } from "../services/DatabaseService";
import {
    StorageFileIdFormat,
    StorageFolderIdFormat,
    StorageVecstoreIdFormat,
    createStorageFileId,
    createStorageVecstoreId,
} from "../../src/utils/creators";

type RawStorageFolderData = {
    id: StorageFolderIdFormat;
    vecstore_id: StorageVecstoreIdFormat | null;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

type RawStorageFileData = {
    id: StorageFileIdFormat;
    folder_id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

type RawStorageVecstoreData = {
    id: StorageVecstoreIdFormat;
    name: string;
    folder_id: StorageFolderIdFormat;
    description: string;
    path: string;
    size: number;
    entities_count: number;
    created_at: string;
    updated_at: string;
};

const mapStorageFolder = (row: RawStorageFolderData): StorageFolderEntity => ({
    id: row.id,
    vecstore_id: row.vecstore_id ?? undefined,
    name: row.name,
    path: row.path,
    size: row.size,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const mapStorageFile = (row: RawStorageFileData): StorageFileEntity => ({
    id: row.id,
    folder_id: row.folder_id,
    name: row.name,
    path: row.path,
    size: row.size,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const mapStorageVecstore = (
    row: RawStorageVecstoreData,
): StorageVecstoreEntity => ({
    id: row.id,
    name: row.name,
    folder_id: row.folder_id,
    description: row.description,
    path: row.path,
    size: row.size,
    entities_count: row.entities_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export class StorageRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly storageRootPath: string,
    ) {}

    findAll(): StorageFolderEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_folders ORDER BY updated_at DESC")
            .all() as RawStorageFolderData[];

        return rows.map(mapStorageFolder);
    }

    findAllFiles(): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_files ORDER BY updated_at DESC")
            .all() as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    findAllVecstores(): StorageVecstoreEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_vecstores ORDER BY updated_at DESC")
            .all() as RawStorageVecstoreData[];

        return rows.map(mapStorageVecstore);
    }

    findFilesByFolderId(folderId: string): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                "SELECT * FROM storage_files WHERE folder_id = ? ORDER BY updated_at DESC",
            )
            .all(folderId) as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    findFolderByName(name: string): StorageFolderEntity | null {
        const normalizedName = name.trim();

        if (!normalizedName) {
            return null;
        }

        const row = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM storage_folders
                WHERE LOWER(name) = LOWER(?)
                ORDER BY updated_at DESC
                LIMIT 1
                `,
            )
            .get(normalizedName) as RawStorageFolderData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageFolder(row);
    }

    createStorageFolder(payload: CreateStorageFolderDto): StorageFolderEntity {
        const now = new Date().toISOString();
        const normalizedPath = path.normalize(
            path.join(this.storageRootPath, payload.id),
        );

        if (!fs.existsSync(normalizedPath)) {
            fs.mkdirSync(normalizedPath, { recursive: true });
        }

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO storage_folders (id, name, path, size, created_at, updated_at)
                VALUES (@id, @name, @path, @size, @created_at, @updated_at)
                `,
            )
            .run({
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

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE storage_folders
                SET name = @name, updated_at = @updated_at
                WHERE id = @id
                `,
            )
            .run({
                id,
                name: name.trim(),
                updated_at: now,
            });

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
        const statement = this.databaseService.getDatabase().prepare(
            `
                INSERT INTO storage_files (id, folder_id, name, path, size, created_at, updated_at)
                VALUES (@id, @folder_id, @name, @path, @size, @created_at, @updated_at)
                `,
        );

        const createdIds: string[] = [];

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

            statement.run({
                id: file.id,
                folder_id: folderId,
                name: path.relative(folder.path, targetPath) || sourceName,
                path: targetPath,
                size: this.bytesToMb(targetStats.size),
                created_at: now,
                updated_at: now,
            });

            createdIds.push(file.id);
        }

        this.recalculateFolderSize(folderId);

        if (createdIds.length === 0) {
            return [];
        }

        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT * FROM storage_files
                WHERE id IN (${createdIds.map(() => "?").join(",")})
                ORDER BY updated_at DESC
                `,
            )
            .all(...createdIds) as RawStorageFileData[];

        return rows.map(mapStorageFile);
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

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO storage_vecstores (id, name, folder_id, description, path, size, entities_count, created_at, updated_at)
                VALUES (@id, @name, @folder_id, @description, @path, @size, @entities_count, @created_at, @updated_at)
                `,
            )
            .run({
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

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE storage_folders
                SET vecstore_id = @vecstore_id, updated_at = @updated_at
                WHERE id = @id
                `,
            )
            .run({
                id: folder.id,
                vecstore_id: vecstoreId,
                updated_at: now,
            });

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

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE storage_vecstores
                SET name = @name, updated_at = @updated_at
                WHERE id = @id
                `,
            )
            .run({
                id,
                name: name.trim(),
                updated_at: now,
            });

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

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE storage_folders
                SET vecstore_id = NULL, updated_at = @updated_at
                WHERE vecstore_id = @vecstore_id
                `,
            )
            .run({
                vecstore_id: id,
                updated_at: now,
            });

        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM storage_vecstores WHERE id = ?")
            .run(id);
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
        const database = this.databaseService.getDatabase();
        const deleteStmt = database.prepare(
            "DELETE FROM storage_files WHERE folder_id = ?",
        );
        const insertStmt = database.prepare(
            `
            INSERT INTO storage_files (id, folder_id, name, path, size, created_at, updated_at)
            VALUES (@id, @folder_id, @name, @path, @size, @created_at, @updated_at)
            `,
        );
        const writeTx = database.transaction(() => {
            deleteStmt.run(folderId);

            for (const file of files) {
                insertStmt.run({
                    id: file.id,
                    folder_id: folderId,
                    name: file.name,
                    path: file.path,
                    size: file.size,
                    created_at: now,
                    updated_at: now,
                });
            }
        });

        writeTx();
        this.recalculateFolderSize(folderId);

        return this.findFilesByFolderId(folderId);
    }

    removeFilesFromFolder(folderId: string, fileIds: string[]): void {
        if (fileIds.length === 0) {
            return;
        }

        this.databaseService
            .getDatabase()
            .prepare(
                `
                DELETE FROM storage_files
                WHERE folder_id = ? AND id IN (${fileIds.map(() => "?").join(",")})
                `,
            )
            .run(folderId, ...fileIds);

        this.recalculateFolderSize(folderId);
    }

    deleteStorageFolder(id: string): void {
        const folder = this.findById(id);

        const linkedVecstores = this.databaseService
            .getDatabase()
            .prepare("SELECT path FROM storage_vecstores WHERE folder_id = ?")
            .all(id) as Array<{ path: string }>;

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

        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM storage_folders WHERE id = ?")
            .run(id);
    }

    private findById(id: string): StorageFolderEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_folders WHERE id = ? LIMIT 1")
            .get(id) as RawStorageFolderData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageFolder(row);
    }

    private findVecstoreById(id: string): StorageVecstoreEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_vecstores WHERE id = ? LIMIT 1")
            .get(id) as RawStorageVecstoreData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageVecstore(row);
    }

    private recalculateFolderSize(folderId: string): void {
        const totalSize = this.databaseService
            .getDatabase()
            .prepare(
                "SELECT COALESCE(SUM(size), 0) AS total_size FROM storage_files WHERE folder_id = ?",
            )
            .get(folderId) as { total_size: number };

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE storage_folders
                SET size = @size, updated_at = @updated_at
                WHERE id = @id
                `,
            )
            .run({
                id: folderId,
                size: Number((totalSize.total_size ?? 0).toFixed(4)),
                updated_at: new Date().toISOString(),
            });
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
