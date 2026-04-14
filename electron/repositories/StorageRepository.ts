import fs from "node:fs";
import path from "node:path";
import type {
    AddStorageFileDto,
    CreateStorageFolderDto,
    StorageFileEntity,
    StorageFolderEntity,
} from "../models/storage";
import type { DatabaseService } from "../services/DatabaseService";

type RawStorageFolderData = {
    id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

type RawStorageFileData = {
    id: string;
    folder_id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

const mapStorageFolder = (row: RawStorageFolderData): StorageFolderEntity => ({
    id: row.id,
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
        const id = crypto.randomUUID();
        const normalizedPath = path.normalize(
            path.join(this.storageRootPath, id),
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
                id,
                name: payload.name.trim(),
                path: normalizedPath,
                size: this.calculateFolderSizeMb(normalizedPath),
                created_at: now,
                updated_at: now,
            });

        const created = this.findById(id);

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
            const id = crypto.randomUUID();

            statement.run({
                id,
                folder_id: folderId,
                name: path.relative(folder.path, targetPath) || sourceName,
                path: targetPath,
                size: this.bytesToMb(targetStats.size),
                created_at: now,
                updated_at: now,
            });

            createdIds.push(id);
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
                    id: crypto.randomUUID(),
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
