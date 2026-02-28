import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { attemptSyncOrNull } from "../errors/errorPattern";
import type {
    AppCacheEntry,
    FileManifestEntry,
    JobEventRecord,
    JobEventTag,
    JobRecord,
    SavedFileRecord,
    UpdateVectorStoragePayload,
    VectorTagRecord,
    VectorStorageRecord,
    VectorStorageUsedByProject,
} from "../../../src/types/ElectronApi";

export class DatabaseService {
    private readonly database: Database.Database;

    constructor(private readonly databasePath: string) {
        this.database = new Database(this.databasePath);
        this.database.pragma("journal_mode = WAL");
        this.database.pragma("foreign_keys = ON");
        this.initializeSchema();
    }

    createProfile(
        profileId: string,
        payload: unknown,
        secretKey: string,
    ): void {
        const now = new Date().toISOString();

        this.database
            .prepare(
                `
                INSERT INTO profiles (id, data, secret_key, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(profileId, JSON.stringify(payload), secretKey, now, now);
    }

    hasProfile(profileId: string): boolean {
        const row = this.database
            .prepare(`SELECT id FROM profiles WHERE id = ?`)
            .get(profileId) as { id: string } | undefined;

        return Boolean(row?.id);
    }

    getProfileRaw(profileId: string): unknown | null {
        const row = this.database
            .prepare(`SELECT data FROM profiles WHERE id = ?`)
            .get(profileId) as { data: string } | undefined;

        if (!row) {
            return null;
        }

        return this.tryParseJson(row.data);
    }

    updateProfileRaw(profileId: string, payload: unknown): void {
        this.database
            .prepare(
                `
                UPDATE profiles
                SET data = ?,
                    updated_at = ?
                WHERE id = ?
                `,
            )
            .run(JSON.stringify(payload), new Date().toISOString(), profileId);
    }

    upsertDialogRaw(
        dialogId: string,
        payload: unknown,
        createdBy: string,
    ): void {
        const payloadRecord =
            payload && typeof payload === "object"
                ? (payload as Record<string, unknown>)
                : {};
        const updatedAt =
            typeof payloadRecord.updatedAt === "string" &&
            payloadRecord.updatedAt
                ? payloadRecord.updatedAt
                : new Date().toISOString();

        this.database
            .prepare(
                `
                INSERT INTO dialogs (id, payload_json, updated_at, created_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at,
                    created_by = excluded.created_by
                `,
            )
            .run(dialogId, JSON.stringify(payload), updatedAt, createdBy);
    }

    getDialogsRaw(createdBy: string): unknown[] {
        const rows = this.database
            .prepare(
                `SELECT payload_json
                 FROM dialogs
                 WHERE created_by = ?
                 ORDER BY updated_at DESC`,
            )
            .all(createdBy) as Array<{ payload_json: string }>;

        return rows
            .map((row) => this.tryParseJson(row.payload_json))
            .filter((row) => row !== null);
    }

    deleteDialog(dialogId: string, createdBy: string): void {
        this.database
            .prepare(`DELETE FROM dialogs WHERE id = ? AND created_by = ?`)
            .run(dialogId, createdBy);
    }

    upsertProjectRaw(
        projectId: string,
        payload: unknown,
        createdBy: string,
    ): void {
        const payloadRecord =
            payload && typeof payload === "object"
                ? (payload as Record<string, unknown>)
                : {};
        const updatedAt =
            typeof payloadRecord.updatedAt === "string" &&
            payloadRecord.updatedAt
                ? payloadRecord.updatedAt
                : new Date().toISOString();

        this.database
            .prepare(
                `
                INSERT INTO projects (id, payload_json, updated_at, created_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at,
                    created_by = excluded.created_by
                `,
            )
            .run(projectId, JSON.stringify(payload), updatedAt, createdBy);
    }

    getProjectsRaw(createdBy: string): unknown[] {
        const rows = this.database
            .prepare(
                `SELECT payload_json
                 FROM projects
                 WHERE created_by = ?
                 ORDER BY updated_at DESC`,
            )
            .all(createdBy) as Array<{ payload_json: string }>;

        return rows
            .map((row) => this.tryParseJson(row.payload_json))
            .filter((row) => row !== null);
    }

    deleteProject(projectId: string, createdBy: string): void {
        this.database
            .prepare(`DELETE FROM projects WHERE id = ? AND created_by = ?`)
            .run(projectId, createdBy);
    }

    upsertScenarioRaw(
        scenarioId: string,
        payload: unknown,
        createdBy: string,
    ): void {
        const payloadRecord =
            payload && typeof payload === "object"
                ? (payload as Record<string, unknown>)
                : {};
        const cachedModelScenarioHash =
            typeof payloadRecord.cachedModelScenarioHash === "string"
                ? payloadRecord.cachedModelScenarioHash
                : typeof payloadRecord.cached_model_scenario_hash === "string"
                  ? payloadRecord.cached_model_scenario_hash
                  : null;
        const cachedModelScenario =
            typeof payloadRecord.cachedModelScenario === "string"
                ? payloadRecord.cachedModelScenario
                : typeof payloadRecord.cached_model_scenario === "string"
                  ? payloadRecord.cached_model_scenario
                  : null;

        const payloadForStorage = this.sanitizeScenarioPayload(payloadRecord);

        const updatedAt =
            typeof payloadRecord.updatedAt === "string" &&
            payloadRecord.updatedAt
                ? payloadRecord.updatedAt
                : new Date().toISOString();

        this.database
            .prepare(
                `
                INSERT INTO scenarios (
                    id,
                    payload_json,
                    updated_at,
                    cached_model_scenario_hash,
                    cached_model_scenario,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at,
                    cached_model_scenario_hash = excluded.cached_model_scenario_hash,
                    cached_model_scenario = excluded.cached_model_scenario,
                    created_by = excluded.created_by
                `,
            )
            .run(
                scenarioId,
                JSON.stringify(payloadForStorage),
                updatedAt,
                cachedModelScenarioHash,
                cachedModelScenario,
                createdBy,
            );
    }

    getScenariosRaw(createdBy: string): unknown[] {
        const rows = this.database
            .prepare(
                `SELECT
                    payload_json,
                    cached_model_scenario_hash,
                    cached_model_scenario
                 FROM scenarios
                 WHERE created_by = ?
                 ORDER BY updated_at DESC`,
            )
            .all(createdBy) as Array<{
            payload_json: string;
            cached_model_scenario_hash: string | null;
            cached_model_scenario: string | null;
        }>;

        return rows
            .map((row) => {
                const parsed = this.tryParseJson(row.payload_json);

                if (!parsed || typeof parsed !== "object") {
                    return null;
                }

                return {
                    ...(parsed as Record<string, unknown>),
                    ...(typeof row.cached_model_scenario_hash === "string"
                        ? {
                              cachedModelScenarioHash:
                                  row.cached_model_scenario_hash,
                          }
                        : {}),
                    ...(typeof row.cached_model_scenario === "string"
                        ? {
                              cachedModelScenario: row.cached_model_scenario,
                          }
                        : {}),
                };
            })
            .filter((row) => row !== null);
    }

    deleteScenario(scenarioId: string, createdBy: string): void {
        this.database
            .prepare(`DELETE FROM scenarios WHERE id = ? AND created_by = ?`)
            .run(scenarioId, createdBy);
    }

    upsertFile(
        fileId: string,
        entry: FileManifestEntry,
        createdBy: string,
    ): void {
        this.database
            .prepare(
                `
                INSERT INTO files (id, path, original_name, size, saved_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    path = excluded.path,
                    original_name = excluded.original_name,
                    size = excluded.size,
                    saved_at = excluded.saved_at,
                    created_by = excluded.created_by
                `,
            )
            .run(
                fileId,
                entry.path,
                entry.originalName,
                entry.size,
                entry.savedAt,
                createdBy,
            );
    }

    getFilesByIds(fileIds: string[], createdBy: string): SavedFileRecord[] {
        if (!fileIds.length) {
            return [];
        }

        const placeholders = fileIds.map(() => "?").join(", ");
        const rows = this.database
            .prepare(
                `SELECT id, path, original_name, size, saved_at
                 FROM files
                                 WHERE created_by = ?
                                     AND id IN (${placeholders})`,
            )
            .all(createdBy, ...fileIds) as Array<{
            id: string;
            path: string;
            original_name: string;
            size: number;
            saved_at: string;
        }>;

        const byId = new Map(
            rows.map((row) => [
                row.id,
                {
                    id: row.id,
                    path: row.path,
                    originalName: row.original_name,
                    size: row.size,
                    savedAt: row.saved_at,
                } satisfies SavedFileRecord,
            ]),
        );

        return fileIds
            .map((fileId) => byId.get(fileId))
            .filter((file): file is SavedFileRecord => Boolean(file));
    }

    getAllFiles(createdBy: string): SavedFileRecord[] {
        const rows = this.database
            .prepare(
                `SELECT id, path, original_name, size, saved_at
                 FROM files
                 WHERE created_by = ?
                 ORDER BY saved_at DESC`,
            )
            .all(createdBy) as Array<{
            id: string;
            path: string;
            original_name: string;
            size: number;
            saved_at: string;
        }>;

        return rows.map((row) => ({
            id: row.id,
            path: row.path,
            originalName: row.original_name,
            size: row.size,
            savedAt: row.saved_at,
        }));
    }

    getFileById(fileId: string, createdBy: string): SavedFileRecord | null {
        const row = this.database
            .prepare(
                `SELECT id, path, original_name, size, saved_at
                 FROM files
                 WHERE id = ?
                   AND created_by = ?`,
            )
            .get(fileId, createdBy) as
            | {
                  id: string;
                  path: string;
                  original_name: string;
                  size: number;
                  saved_at: string;
              }
            | undefined;

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            path: row.path,
            originalName: row.original_name,
            size: row.size,
            savedAt: row.saved_at,
        };
    }

    deleteFilesByIds(fileIds: string[], createdBy: string): void {
        if (!fileIds.length) {
            return;
        }

        const statement = this.database.prepare(
            `DELETE FROM files WHERE id = ? AND created_by = ?`,
        );
        const transaction = this.database.transaction((ids: string[]) => {
            for (const fileId of ids) {
                statement.run(fileId, createdBy);
            }
        });

        transaction(fileIds);
    }

    createJob(
        createdBy: string,
        payload: {
            name: string;
            description: string;
        },
    ): JobRecord {
        const now = new Date().toISOString();
        const jobId = `job_${randomUUID().replace(/-/g, "")}`;

        this.database
            .prepare(
                `
                INSERT INTO jobs (
                    id,
                    name,
                    description,
                    is_completed,
                    is_pending,
                    created_at,
                    updated_at,
                    started_at,
                    finished_at,
                    error_message,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                jobId,
                payload.name,
                payload.description,
                0,
                1,
                now,
                now,
                now,
                null,
                null,
                createdBy,
            );

        return this.getJobById(jobId, createdBy)!;
    }

    getJobs(createdBy: string): JobRecord[] {
        const rows = this.database
            .prepare(
                `
                SELECT
                    id,
                    name,
                    description,
                    is_completed,
                    is_pending,
                    created_at,
                    updated_at,
                    started_at,
                    finished_at,
                    error_message
                FROM jobs
                WHERE created_by = ?
                ORDER BY updated_at DESC
                `,
            )
            .all(createdBy) as Array<{
            id: string;
            name: string;
            description: string;
            is_completed: number;
            is_pending: number;
            created_at: string;
            updated_at: string;
            started_at: string;
            finished_at: string | null;
            error_message: string | null;
        }>;

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            isCompleted: row.is_completed === 1,
            isPending: row.is_pending === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            errorMessage: row.error_message,
        }));
    }

    getJobById(jobId: string, createdBy: string): JobRecord | null {
        const row = this.database
            .prepare(
                `
                SELECT
                    id,
                    name,
                    description,
                    is_completed,
                    is_pending,
                    created_at,
                    updated_at,
                    started_at,
                    finished_at,
                    error_message
                FROM jobs
                WHERE id = ? AND created_by = ?
                `,
            )
            .get(jobId, createdBy) as
            | {
                  id: string;
                  name: string;
                  description: string;
                  is_completed: number;
                  is_pending: number;
                  created_at: string;
                  updated_at: string;
                  started_at: string;
                  finished_at: string | null;
                  error_message: string | null;
              }
            | undefined;

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            name: row.name,
            description: row.description,
            isCompleted: row.is_completed === 1,
            isPending: row.is_pending === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            errorMessage: row.error_message,
        };
    }

    updateJob(
        jobId: string,
        createdBy: string,
        payload: {
            isCompleted?: boolean;
            isPending?: boolean;
            finishedAt?: string | null;
            errorMessage?: string | null;
        },
    ): JobRecord | null {
        const current = this.getJobById(jobId, createdBy);

        if (!current) {
            return null;
        }

        const nextIsCompleted =
            typeof payload.isCompleted === "boolean"
                ? payload.isCompleted
                : current.isCompleted;
        const nextIsPending =
            typeof payload.isPending === "boolean"
                ? payload.isPending
                : current.isPending;
        const nextFinishedAt =
            payload.finishedAt !== undefined
                ? payload.finishedAt
                : current.finishedAt;
        const nextErrorMessage =
            payload.errorMessage !== undefined
                ? payload.errorMessage
                : current.errorMessage;

        this.database
            .prepare(
                `
                UPDATE jobs
                SET is_completed = ?,
                    is_pending = ?,
                    finished_at = ?,
                    error_message = ?,
                    updated_at = ?
                WHERE id = ? AND created_by = ?
                `,
            )
            .run(
                nextIsCompleted ? 1 : 0,
                nextIsPending ? 1 : 0,
                nextFinishedAt,
                nextErrorMessage,
                new Date().toISOString(),
                jobId,
                createdBy,
            );

        return this.getJobById(jobId, createdBy);
    }

    addJobEvent(
        createdBy: string,
        jobId: string,
        message: string,
        tag: JobEventTag,
    ): JobEventRecord {
        const now = new Date().toISOString();
        const jobEventId = `job_event_${randomUUID().replace(/-/g, "")}`;

        this.database
            .prepare(
                `
                INSERT INTO jobs_events (
                    id,
                    job_id,
                    message,
                    tag,
                    created_at,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
            )
            .run(jobEventId, jobId, message, tag, now, createdBy);

        return {
            id: jobEventId,
            jobId,
            message,
            tag,
            createdAt: now,
        };
    }

    getJobEvents(jobId: string, createdBy: string): JobEventRecord[] {
        const rows = this.database
            .prepare(
                `
                SELECT id, job_id, message, tag, created_at
                FROM jobs_events
                WHERE job_id = ? AND created_by = ?
                ORDER BY created_at DESC
                `,
            )
            .all(jobId, createdBy) as Array<{
            id: string;
            job_id: string;
            message: string;
            tag: JobEventTag;
            created_at: string;
        }>;

        return rows.map((row) => ({
            id: row.id,
            jobId: row.job_id,
            message: row.message,
            tag: row.tag,
            createdAt: row.created_at,
        }));
    }

    markPendingJobsAsInterrupted(createdBy: string): string[] {
        const rows = this.database
            .prepare(
                `
                SELECT id
                FROM jobs
                WHERE created_by = ? AND is_pending = 1
                `,
            )
            .all(createdBy) as Array<{ id: string }>;

        if (!rows.length) {
            return [];
        }

        const now = new Date().toISOString();

        this.database
            .prepare(
                `
                UPDATE jobs
                SET is_pending = 0,
                    is_completed = 0,
                    finished_at = ?,
                    error_message = ?,
                    updated_at = ?
                WHERE created_by = ? AND is_pending = 1
                `,
            )
            .run(
                now,
                "Процесс был остановлен при перезапуске приложения",
                now,
                createdBy,
            );

        for (const row of rows) {
            this.addJobEvent(
                createdBy,
                row.id,
                "Задача остановлена из-за перезапуска приложения",
                "warning",
            );
        }

        return rows.map((row) => row.id);
    }

    createVectorStorage(
        createdBy: string,
        name: string,
        dataPath: string,
        vectorStorageId?: string,
    ): VectorStorageRecord {
        const now = new Date().toISOString();
        const normalizedVectorStorageId =
            typeof vectorStorageId === "string" && vectorStorageId.trim()
                ? vectorStorageId.trim()
                : `vs_${randomUUID().replace(/-/g, "")}`;

        this.database
            .prepare(
                `
                INSERT INTO vector_storages (
                    id,
                    name,
                    size,
                    data_path,
                    last_active_at,
                    created_at,
                    updated_at,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                normalizedVectorStorageId,
                name,
                0,
                typeof dataPath === "string" ? dataPath.trim() : "",
                now,
                now,
                now,
                createdBy,
            );

        return this.getVectorStorageById(normalizedVectorStorageId, createdBy)!;
    }

    getVectorTags(createdBy: string): VectorTagRecord[] {
        const rows = this.database
            .prepare(
                `
                SELECT id, name, created_at, updated_at
                FROM vector_tags
                WHERE created_by = ?
                ORDER BY updated_at DESC
                `,
            )
            .all(createdBy) as Array<{
            id: string;
            name: string;
            created_at: string;
            updated_at: string;
        }>;

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }

    createVectorTag(createdBy: string, name: string): VectorTagRecord | null {
        const normalizedName = typeof name === "string" ? name.trim() : "";

        if (!normalizedName) {
            return null;
        }

        const existing = this.database
            .prepare(
                `
                SELECT id, name, created_at, updated_at
                FROM vector_tags
                WHERE created_by = ?
                  AND lower(name) = lower(?)
                LIMIT 1
                `,
            )
            .get(createdBy, normalizedName) as
            | {
                  id: string;
                  name: string;
                  created_at: string;
                  updated_at: string;
              }
            | undefined;

        if (existing) {
            return {
                id: existing.id,
                name: existing.name,
                createdAt: existing.created_at,
                updatedAt: existing.updated_at,
            };
        }

        const now = new Date().toISOString();
        const tagId = `vt_${randomUUID().replace(/-/g, "")}`;

        this.database
            .prepare(
                `
                INSERT INTO vector_tags (
                    id,
                    name,
                    created_at,
                    updated_at,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(tagId, normalizedName, now, now, createdBy);

        return {
            id: tagId,
            name: normalizedName,
            createdAt: now,
            updatedAt: now,
        };
    }

    deleteVectorStorage(vectorStorageId: string, createdBy: string): boolean {
        const result = this.database
            .prepare(
                `
                DELETE FROM vector_storages
                WHERE id = ? AND created_by = ?
                `,
            )
            .run(vectorStorageId, createdBy);

        return result.changes > 0;
    }

    updateVectorStorage(
        vectorStorageId: string,
        payload: UpdateVectorStoragePayload,
        createdBy: string,
    ): VectorStorageRecord | null {
        const existing = this.database
            .prepare(
                `
                                SELECT id, name, size, data_path, last_active_at
                FROM vector_storages
                WHERE id = ? AND created_by = ?
                `,
            )
            .get(vectorStorageId, createdBy) as
            | {
                  id: string;
                  name: string;
                  size: number;
                  data_path: string;
                  last_active_at: string;
              }
            | undefined;

        if (!existing) {
            return null;
        }

        const nextName =
            typeof payload.name === "string" && payload.name.trim()
                ? payload.name.trim()
                : existing.name;
        const nextSize =
            typeof payload.size === "number" && Number.isFinite(payload.size)
                ? Math.max(0, payload.size)
                : existing.size;
        const nextDataPath =
            typeof payload.dataPath === "string"
                ? payload.dataPath.trim()
                : existing.data_path;
        const nextLastActiveAt =
            typeof payload.lastActiveAt === "string" && payload.lastActiveAt
                ? payload.lastActiveAt
                : existing.last_active_at;

        this.database
            .prepare(
                `
                UPDATE vector_storages
                SET name = ?,
                    size = ?,
                    data_path = ?,
                    last_active_at = ?,
                    updated_at = ?
                WHERE id = ? AND created_by = ?
                `,
            )
            .run(
                nextName,
                nextSize,
                nextDataPath,
                nextLastActiveAt,
                new Date().toISOString(),
                vectorStorageId,
                createdBy,
            );

        if (Array.isArray(payload.fileIds)) {
            this.replaceVectorStorageFiles(
                vectorStorageId,
                payload.fileIds,
                createdBy,
            );
        }

        if (Array.isArray(payload.projectIds)) {
            this.replaceVectorStorageProjects(
                vectorStorageId,
                payload.projectIds,
                createdBy,
            );
        }

        if (Array.isArray(payload.tagIds)) {
            this.replaceVectorStorageTags(
                vectorStorageId,
                payload.tagIds,
                createdBy,
            );
        }

        return this.getVectorStorageById(vectorStorageId, createdBy);
    }

    getVectorStorages(createdBy: string): VectorStorageRecord[] {
        const storageRows = this.database
            .prepare(
                `
                SELECT id, name, size, data_path, last_active_at, created_at
                FROM vector_storages
                WHERE created_by = ?
                ORDER BY created_at DESC
                `,
            )
            .all(createdBy) as Array<{
            id: string;
            name: string;
            size: number;
            data_path: string;
            last_active_at: string;
            created_at: string;
        }>;

        if (!storageRows.length) {
            return [];
        }

        const storageIds = storageRows.map((row) => row.id);
        const placeholders = storageIds.map(() => "?").join(", ");

        const fileRelationRows = this.database
            .prepare(
                `
                SELECT vector_storage_id, file_id
                FROM vector_storage_files
                WHERE created_by = ?
                  AND vector_storage_id IN (${placeholders})
                `,
            )
            .all(createdBy, ...storageIds) as Array<{
            vector_storage_id: string;
            file_id: string;
        }>;

        const projectRelationRows = this.database
            .prepare(
                `
                SELECT vsp.vector_storage_id, vsp.project_id, p.payload_json
                FROM vector_storage_projects vsp
                JOIN projects p ON p.id = vsp.project_id AND p.created_by = vsp.created_by
                WHERE vsp.created_by = ?
                  AND vsp.vector_storage_id IN (${placeholders})
                `,
            )
            .all(createdBy, ...storageIds) as Array<{
            vector_storage_id: string;
            project_id: string;
            payload_json: string;
        }>;

        const tagRelationRows = this.database
            .prepare(
                `
                SELECT vst.vector_storage_id, t.id AS tag_id, t.name AS tag_name, t.created_at, t.updated_at
                FROM vector_storage_tags vst
                JOIN vector_tags t ON t.id = vst.tag_id AND t.created_by = vst.created_by
                WHERE vst.created_by = ?
                  AND vst.vector_storage_id IN (${placeholders})
                ORDER BY t.name COLLATE NOCASE ASC
                `,
            )
            .all(createdBy, ...storageIds) as Array<{
            vector_storage_id: string;
            tag_id: string;
            tag_name: string;
            created_at: string;
            updated_at: string;
        }>;

        const fileIdsByStorageId = new Map<string, string[]>();
        for (const row of fileRelationRows) {
            const current = fileIdsByStorageId.get(row.vector_storage_id) ?? [];
            current.push(row.file_id);
            fileIdsByStorageId.set(row.vector_storage_id, current);
        }

        const projectRefsByStorageId = new Map<
            string,
            VectorStorageUsedByProject[]
        >();
        for (const row of projectRelationRows) {
            const parsedProject = this.tryParseJson(row.payload_json) as {
                name?: unknown;
            } | null;
            const title =
                parsedProject && typeof parsedProject.name === "string"
                    ? parsedProject.name
                    : "Проект";

            const current =
                projectRefsByStorageId.get(row.vector_storage_id) ?? [];
            current.push({
                id: row.project_id,
                title,
            });
            projectRefsByStorageId.set(row.vector_storage_id, current);
        }

        const tagsByStorageId = new Map<string, VectorTagRecord[]>();
        for (const row of tagRelationRows) {
            const current = tagsByStorageId.get(row.vector_storage_id) ?? [];
            current.push({
                id: row.tag_id,
                name: row.tag_name,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
            tagsByStorageId.set(row.vector_storage_id, current);
        }

        return storageRows.map((row) => ({
            id: row.id,
            name: row.name,
            size: row.size,
            dataPath: row.data_path,
            lastActiveAt: row.last_active_at,
            createdAt: row.created_at,
            fileIds: fileIdsByStorageId.get(row.id) ?? [],
            tags: tagsByStorageId.get(row.id) ?? [],
            usedByProjects: projectRefsByStorageId.get(row.id) ?? [],
        }));
    }

    getVectorStorageById(
        vectorStorageId: string,
        createdBy: string,
    ): VectorStorageRecord | null {
        return (
            this.getVectorStorages(createdBy).find(
                (vectorStorage) => vectorStorage.id === vectorStorageId,
            ) ?? null
        );
    }

    private replaceVectorStorageFiles(
        vectorStorageId: string,
        fileIds: string[],
        createdBy: string,
    ): void {
        this.database
            .prepare(
                `
                DELETE FROM vector_storage_files
                WHERE vector_storage_id = ? AND created_by = ?
                `,
            )
            .run(vectorStorageId, createdBy);

        const insertStmt = this.database.prepare(
            `
            INSERT OR IGNORE INTO vector_storage_files (
                vector_storage_id,
                file_id,
                created_by
            )
            VALUES (?, ?, ?)
            `,
        );

        for (const fileId of fileIds) {
            insertStmt.run(vectorStorageId, fileId, createdBy);
        }
    }

    private replaceVectorStorageProjects(
        vectorStorageId: string,
        projectIds: string[],
        createdBy: string,
    ): void {
        this.database
            .prepare(
                `
                DELETE FROM vector_storage_projects
                WHERE vector_storage_id = ? AND created_by = ?
                `,
            )
            .run(vectorStorageId, createdBy);

        const insertStmt = this.database.prepare(
            `
            INSERT OR IGNORE INTO vector_storage_projects (
                vector_storage_id,
                project_id,
                created_by
            )
            VALUES (?, ?, ?)
            `,
        );

        for (const projectId of projectIds) {
            insertStmt.run(vectorStorageId, projectId, createdBy);
        }
    }

    private replaceVectorStorageTags(
        vectorStorageId: string,
        tagIds: string[],
        createdBy: string,
    ): void {
        this.database
            .prepare(
                `
                DELETE FROM vector_storage_tags
                WHERE vector_storage_id = ? AND created_by = ?
                `,
            )
            .run(vectorStorageId, createdBy);

        const normalizedTagIds = [
            ...new Set(
                tagIds
                    .map((tagId) =>
                        typeof tagId === "string" ? tagId.trim() : "",
                    )
                    .filter((tagId) => tagId.length > 0),
            ),
        ];

        if (!normalizedTagIds.length) {
            return;
        }

        const placeholders = normalizedTagIds.map(() => "?").join(", ");
        const existingTagRows = this.database
            .prepare(
                `
                SELECT id
                FROM vector_tags
                WHERE created_by = ?
                  AND id IN (${placeholders})
                `,
            )
            .all(createdBy, ...normalizedTagIds) as Array<{ id: string }>;

        if (!existingTagRows.length) {
            return;
        }

        const insertStmt = this.database.prepare(
            `
            INSERT OR IGNORE INTO vector_storage_tags (
                vector_storage_id,
                tag_id,
                created_by
            )
            VALUES (?, ?, ?)
            `,
        );

        for (const row of existingTagRows) {
            insertStmt.run(vectorStorageId, row.id, createdBy);
        }
    }

    getCacheEntry(key: string): AppCacheEntry | null {
        const row = this.database
            .prepare(
                `SELECT collected_at, ttl_seconds, expires_at, data_json
                 FROM cache
                 WHERE key = ?`,
            )
            .get(key) as
            | {
                  collected_at: number;
                  ttl_seconds: number;
                  expires_at: number;
                  data_json: string;
              }
            | undefined;

        if (!row) {
            return null;
        }

        const parsedData = this.tryParseJson(row.data_json);

        if (parsedData === null) {
            return null;
        }

        return {
            collectedAt: row.collected_at,
            ttlSeconds: row.ttl_seconds,
            expiresAt: row.expires_at,
            data: parsedData,
        };
    }

    setCacheEntry(key: string, entry: AppCacheEntry): void {
        this.database
            .prepare(
                `
                INSERT INTO cache (key, collected_at, ttl_seconds, expires_at, data_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    collected_at = excluded.collected_at,
                    ttl_seconds = excluded.ttl_seconds,
                    expires_at = excluded.expires_at,
                    data_json = excluded.data_json
                `,
            )
            .run(
                key,
                entry.collectedAt,
                entry.ttlSeconds,
                entry.expiresAt,
                JSON.stringify(entry.data),
            );
    }

    private initializeSchema(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                secret_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dialogs (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS scenarios (
                id TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                cached_model_scenario_hash TEXT,
                cached_model_scenario TEXT,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                original_name TEXT NOT NULL,
                size INTEGER NOT NULL,
                saved_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                collected_at INTEGER NOT NULL,
                ttl_seconds INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                data_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                is_completed INTEGER NOT NULL DEFAULT 0,
                is_pending INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                error_message TEXT,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS jobs_events (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                message TEXT NOT NULL,
                tag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS vector_storages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                data_path TEXT NOT NULL DEFAULT '',
                last_active_at TEXT NOT NULL,
                expires_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS vector_storage_files (
                vector_storage_id TEXT NOT NULL,
                file_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                PRIMARY KEY(vector_storage_id, file_id),
                FOREIGN KEY(vector_storage_id) REFERENCES vector_storages(id) ON DELETE CASCADE,
                FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS vector_storage_projects (
                vector_storage_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                PRIMARY KEY(vector_storage_id, project_id),
                FOREIGN KEY(vector_storage_id) REFERENCES vector_storages(id) ON DELETE CASCADE,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS vector_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE,
                UNIQUE(created_by, name)
            );

            CREATE TABLE IF NOT EXISTS vector_storage_tags (
                vector_storage_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                PRIMARY KEY(vector_storage_id, tag_id),
                FOREIGN KEY(vector_storage_id) REFERENCES vector_storages(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES vector_tags(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_dialogs_created_by ON dialogs(created_by);
            CREATE INDEX IF NOT EXISTS idx_dialogs_updated_at ON dialogs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
            CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON scenarios(created_by);
            CREATE INDEX IF NOT EXISTS idx_scenarios_updated_at ON scenarios(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);
            CREATE INDEX IF NOT EXISTS idx_vector_storages_created_by ON vector_storages(created_by);
            CREATE INDEX IF NOT EXISTS idx_vector_storages_updated_at ON vector_storages(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_vector_storage_files_created_by ON vector_storage_files(created_by);
            CREATE INDEX IF NOT EXISTS idx_vector_storage_projects_created_by ON vector_storage_projects(created_by);
            CREATE INDEX IF NOT EXISTS idx_vector_tags_created_by ON vector_tags(created_by);
            CREATE INDEX IF NOT EXISTS idx_vector_storage_tags_created_by ON vector_storage_tags(created_by);
            CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
            CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_events_job_id ON jobs_events(job_id);
            CREATE INDEX IF NOT EXISTS idx_jobs_events_created_at ON jobs_events(created_at DESC);
        `);

        this.ensureVectorStoragesDataPathColumn();
    }

    private ensureVectorStoragesDataPathColumn(): void {
        const columns = this.database
            .prepare(`PRAGMA table_info(vector_storages)`)
            .all() as Array<{ name: string }>;

        const hasDataPath = columns.some(
            (column) => column.name === "data_path",
        );

        if (hasDataPath) {
            return;
        }

        this.database.exec(
            `ALTER TABLE vector_storages ADD COLUMN data_path TEXT NOT NULL DEFAULT ''`,
        );
    }

    private sanitizeScenarioPayload(
        payloadRecord: Record<string, unknown>,
    ): Record<string, unknown> {
        const content =
            payloadRecord.content &&
            typeof payloadRecord.content === "object" &&
            !Array.isArray(payloadRecord.content)
                ? ({
                      ...(payloadRecord.content as Record<string, unknown>),
                  } as Record<string, unknown>)
                : undefined;

        if (content && "scenarioFlowCache" in content) {
            delete content.scenarioFlowCache;
        }

        return {
            ...payloadRecord,
            ...(content ? { content } : {}),
            cachedModelScenarioHash: undefined,
            cachedModelScenario: undefined,
            cached_model_scenario_hash: undefined,
            cached_model_scenario: undefined,
        };
    }

    private tryParseJson(raw: string): unknown | null {
        return attemptSyncOrNull(() => JSON.parse(raw));
    }
}
