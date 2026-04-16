import type { StorageVecstoreEntity } from "../../models/storage";
import type { DatabaseService } from "../../services/DatabaseService";
import {
    StorageFolderIdFormat,
    StorageVecstoreIdFormat,
} from "../../../src/utils/creators";

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

export class StorageVecstoresRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll(): StorageVecstoreEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_vecstores ORDER BY updated_at DESC")
            .all() as RawStorageVecstoreData[];

        return rows.map(mapStorageVecstore);
    }

    findById(id: string): StorageVecstoreEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_vecstores WHERE id = ? LIMIT 1")
            .get(id) as RawStorageVecstoreData | undefined;

        if (!row) {
            return null;
        }

        return mapStorageVecstore(row);
    }

    findByFolderId(folderId: string): StorageVecstoreEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                "SELECT * FROM storage_vecstores WHERE folder_id = ? ORDER BY updated_at DESC",
            )
            .all(folderId) as RawStorageVecstoreData[];

        return rows.map(mapStorageVecstore);
    }

    findIds(): StorageVecstoreIdFormat[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT id FROM storage_vecstores")
            .all() as Array<{ id: StorageVecstoreIdFormat }>;

        return rows.map((row) => row.id);
    }

    create(payload: {
        id: string;
        name: string;
        folder_id: string;
        description: string;
        path: string;
        size: number;
        entities_count: number;
        created_at: string;
        updated_at: string;
    }): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				INSERT INTO storage_vecstores (id, name, folder_id, description, path, size, entities_count, created_at, updated_at)
				VALUES (@id, @name, @folder_id, @description, @path, @size, @entities_count, @created_at, @updated_at)
				`,
            )
            .run(payload);
    }

    rename(
        id: string,
        name: string,
        description: string,
        updatedAt: string,
    ): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_vecstores
				SET name = @name, description = @description, updated_at = @updated_at
				WHERE id = @id
				`,
            )
            .run({
                id,
                name,
                description,
                updated_at: updatedAt,
            });
    }

    updateMetrics(
        id: string,
        size: number,
        entitiesCount: number,
        updatedAt: string,
    ): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_vecstores
				SET size = @size, entities_count = @entities_count, updated_at = @updated_at
				WHERE id = @id
				`,
            )
            .run({
                id,
                size,
                entities_count: entitiesCount,
                updated_at: updatedAt,
            });
    }

    deleteById(id: string): void {
        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM storage_vecstores WHERE id = ?")
            .run(id);
    }
}
