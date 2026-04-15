import type { StorageFolderEntity } from "../../models/storage";
import type { DatabaseService } from "../../services/DatabaseService";
import {
    StorageFolderIdFormat,
    StorageVecstoreIdFormat,
} from "../../../src/utils/creators";

type RawStorageFolderData = {
    id: StorageFolderIdFormat;
    vecstore_id: StorageVecstoreIdFormat | null;
    name: string;
    path: string;
    size: number;
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

export class StorageFoldersRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll(): StorageFolderEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_folders ORDER BY updated_at DESC")
            .all() as RawStorageFolderData[];

        return rows.map(mapStorageFolder);
    }

    findById(id: string): StorageFolderEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_folders WHERE id = ? LIMIT 1")
            .get(id) as RawStorageFolderData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageFolder(row);
    }

    findByName(name: string): StorageFolderEntity | null {
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
            .get(name) as RawStorageFolderData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageFolder(row);
    }

    create(payload: {
        id: string;
        name: string;
        path: string;
        size: number;
        created_at: string;
        updated_at: string;
    }): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				INSERT INTO storage_folders (id, name, path, size, created_at, updated_at)
				VALUES (@id, @name, @path, @size, @created_at, @updated_at)
				`,
            )
            .run(payload);
    }

    rename(id: string, name: string, updatedAt: string): void {
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
                name,
                updated_at: updatedAt,
            });
    }

    updateLinkedVecstore(
        folderId: string,
        vecstoreId: string,
        updatedAt: string,
    ): void {
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
                id: folderId,
                vecstore_id: vecstoreId,
                updated_at: updatedAt,
            });
    }

    clearLinkedVecstoreByVecstoreId(
        vecstoreId: string,
        updatedAt: string,
    ): void {
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
                vecstore_id: vecstoreId,
                updated_at: updatedAt,
            });
    }

    updateSize(folderId: string, size: number, updatedAt: string): void {
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
                size,
                updated_at: updatedAt,
            });
    }

    deleteById(id: string): void {
        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM storage_folders WHERE id = ?")
            .run(id);
    }
}
