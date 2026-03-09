import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { attemptSyncOrNull } from "../../errors/errorPattern";
import type {
    AppCacheEntry,
    FileManifestEntry,
    JobEventRecord,
    JobEventTag,
    JobRecord,
    SavedFileRecord,
} from "../../../src/types/ElectronApi";

export class DatabaseService {
    private readonly database: Database.Database;

    constructor(private readonly databasePath: string) {
        this.database = new Database(this.databasePath);
        this.database.pragma("journal_mode = WAL");
        this.database.pragma("foreign_keys = ON");
        this.initializeSchema();
    }

    execRaw<T = unknown>(
        sql: string,
        params: unknown[] = [],
        mode: "all" | "get" | "run" = "all",
    ): T[] | T | undefined | Database.RunResult {
        const statement = this.database.prepare(sql);

        if (mode === "run") {
            return statement.run(...params);
        }

        if (mode === "get") {
            return statement.get(...params) as T | undefined;
        }

        return statement.all(...params) as T[];
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

            CREATE INDEX IF NOT EXISTS idx_dialogs_created_by ON dialogs(created_by);
            CREATE INDEX IF NOT EXISTS idx_dialogs_updated_at ON dialogs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
            CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON scenarios(created_by);
            CREATE INDEX IF NOT EXISTS idx_scenarios_updated_at ON scenarios(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);
            CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
            CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_events_job_id ON jobs_events(job_id);
            CREATE INDEX IF NOT EXISTS idx_jobs_events_created_at ON jobs_events(created_at DESC);
        `);
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
