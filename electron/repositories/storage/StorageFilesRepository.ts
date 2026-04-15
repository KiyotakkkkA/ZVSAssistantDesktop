import type { StorageFileEntity } from "../../models/storage";
import type { DatabaseService } from "../../services/DatabaseService";
import {
    StorageFileIdFormat,
    StorageVecstoreIdFormat,
} from "../../../src/utils/creators";

type RawStorageFileData = {
    id: StorageFileIdFormat;
    folder_id: string;
    vecstore_id: StorageVecstoreIdFormat | null;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

export type StorageFileRecordPayload = {
    id: string;
    folder_id: string;
    vecstore_id: string | null;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
};

const mapStorageFile = (row: RawStorageFileData): StorageFileEntity => ({
    id: row.id,
    folder_id: row.folder_id,
    vecstore_id: row.vecstore_id ?? undefined,
    name: row.name,
    path: row.path,
    size: row.size,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export class StorageFilesRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll(): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM storage_files ORDER BY updated_at DESC")
            .all() as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    findByFolderId(folderId: string): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                "SELECT * FROM storage_files WHERE folder_id = ? ORDER BY updated_at DESC",
            )
            .all(folderId) as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    findVectorizedByFolderId(folderId: string): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
				SELECT *
				FROM storage_files
				WHERE folder_id = ? AND vecstore_id IS NOT NULL
				ORDER BY updated_at DESC
				`,
            )
            .all(folderId) as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    findNonVectorizedByFolderId(folderId: string): StorageFileEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
				SELECT *
				FROM storage_files
				WHERE folder_id = ? AND vecstore_id IS NULL
				ORDER BY updated_at DESC
				`,
            )
            .all(folderId) as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    insertMany(records: StorageFileRecordPayload[]): void {
        if (records.length === 0) {
            return;
        }

        const database = this.databaseService.getDatabase();
        const insertStatement = database.prepare(
            `
			INSERT INTO storage_files (id, folder_id, vecstore_id, name, path, size, created_at, updated_at)
			VALUES (@id, @folder_id, @vecstore_id, @name, @path, @size, @created_at, @updated_at)
			`,
        );

        const insertTx = database.transaction(() => {
            for (const record of records) {
                insertStatement.run(record);
            }
        });

        insertTx();
    }

    findByIds(ids: string[]): StorageFileEntity[] {
        if (ids.length === 0) {
            return [];
        }

        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
				SELECT * FROM storage_files
				WHERE id IN (${ids.map(() => "?").join(",")})
				ORDER BY updated_at DESC
				`,
            )
            .all(...ids) as RawStorageFileData[];

        return rows.map(mapStorageFile);
    }

    replaceFolderFiles(
        folderId: string,
        records: StorageFileRecordPayload[],
    ): void {
        const database = this.databaseService.getDatabase();
        const deleteStatement = database.prepare(
            "DELETE FROM storage_files WHERE folder_id = ?",
        );
        const insertStatement = database.prepare(
            `
			INSERT INTO storage_files (id, folder_id, vecstore_id, name, path, size, created_at, updated_at)
			VALUES (@id, @folder_id, @vecstore_id, @name, @path, @size, @created_at, @updated_at)
			`,
        );

        const replaceTx = database.transaction(() => {
            deleteStatement.run(folderId);

            for (const record of records) {
                insertStatement.run(record);
            }
        });

        replaceTx();
    }

    deleteByFolderAndIds(folderId: string, fileIds: string[]): void {
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
    }

    clearVecstoreByVecstoreId(vecstoreId: string): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_files
				SET vecstore_id = NULL
				WHERE vecstore_id = ?
				`,
            )
            .run(vecstoreId);
    }

    clearFilesVecstore(
        fileIds: string[],
        updatedAt: string,
        vecstoreId?: string,
    ): void {
        if (fileIds.length === 0) {
            return;
        }

        const idPlaceholders = fileIds.map(() => "?").join(",");

        if (vecstoreId) {
            this.databaseService
                .getDatabase()
                .prepare(
                    `
					UPDATE storage_files
					SET vecstore_id = NULL, updated_at = ?
					WHERE vecstore_id = ? AND id IN (${idPlaceholders})
					`,
                )
                .run(updatedAt, vecstoreId, ...fileIds);

            return;
        }

        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_files
				SET vecstore_id = NULL, updated_at = ?
				WHERE id IN (${idPlaceholders})
				`,
            )
            .run(updatedAt, ...fileIds);
    }

    linkFolderFilesToVecstore(
        folderId: string,
        vecstoreId: string,
        updatedAt: string,
    ): void {
        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_files
				SET vecstore_id = @vecstore_id, updated_at = @updated_at
				WHERE folder_id = @folder_id
				`,
            )
            .run({
                folder_id: folderId,
                vecstore_id: vecstoreId,
                updated_at: updatedAt,
            });
    }

    linkFilesToVecstore(
        fileIds: string[],
        vecstoreId: string,
        updatedAt: string,
    ): void {
        if (fileIds.length === 0) {
            return;
        }

        this.databaseService
            .getDatabase()
            .prepare(
                `
				UPDATE storage_files
				SET vecstore_id = ?, updated_at = ?
				WHERE id IN (${fileIds.map(() => "?").join(",")})
				`,
            )
            .run(vecstoreId, updatedAt, ...fileIds);
    }

    sumSizeByFolderId(folderId: string): number {
        const row = this.databaseService
            .getDatabase()
            .prepare(
                "SELECT COALESCE(SUM(size), 0) AS total_size FROM storage_files WHERE folder_id = ?",
            )
            .get(folderId) as { total_size: number };

        return Number((row.total_size ?? 0).toFixed(4));
    }

    getVecstoreMetrics(vecstoreId: string): {
        total_size: number;
        entities_count: number;
    } {
        const row = this.databaseService
            .getDatabase()
            .prepare(
                `
				SELECT
					COALESCE(SUM(size), 0) AS total_size,
					COUNT(*) AS entities_count
				FROM storage_files
				WHERE vecstore_id = ?
				`,
            )
            .get(vecstoreId) as {
            total_size: number;
            entities_count: number;
        };

        return {
            total_size: Number((row.total_size ?? 0).toFixed(4)),
            entities_count: row.entities_count ?? 0,
        };
    }
}
