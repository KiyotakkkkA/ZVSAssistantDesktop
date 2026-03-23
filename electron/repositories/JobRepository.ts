import type { JobEventRecord, JobEventTag, JobRecord } from "../models/job";
import type { DatabaseService } from "../services/DatabaseService";

type RawJobData = {
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
    created_by: string;
};

type RawJobEventData = {
    id: string;
    job_id: string;
    message: string;
    tag: JobEventTag;
    created_at: string;
    created_by: string;
};

const mapJob = (raw: RawJobData): JobRecord => ({
    id: raw.id,
    name: raw.name,
    description: raw.description,
    isCompleted: raw.is_completed === 1,
    isPending: raw.is_pending === 1,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    startedAt: raw.started_at,
    finishedAt: raw.finished_at,
    errorMessage: raw.error_message,
    createdBy: raw.created_by,
});

const mapJobEvent = (raw: RawJobEventData): JobEventRecord => ({
    id: raw.id,
    jobId: raw.job_id,
    message: raw.message,
    tag: raw.tag,
    createdAt: raw.created_at,
    createdBy: raw.created_by,
});

export class JobRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    getJobs(createdBy: string): JobRecord[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM jobs
                WHERE created_by = ?
                ORDER BY updated_at DESC
                `,
            )
            .all(createdBy) as RawJobData[];

        return rows.map(mapJob);
    }

    getJobById(jobId: string, createdBy: string): JobRecord | null {
        const row = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM jobs
                WHERE id = @jobId AND created_by = @createdBy
                LIMIT 1
                `,
            )
            .get({ jobId, createdBy }) as RawJobData | undefined;

        return row ? mapJob(row) : null;
    }

    getJobEvents(jobId: string, createdBy: string): JobEventRecord[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM jobs_events
                WHERE job_id = @jobId AND created_by = @createdBy
                ORDER BY created_at DESC
                `,
            )
            .all({ jobId, createdBy }) as RawJobEventData[];

        return rows.map(mapJobEvent);
    }

    createJob(
        createdBy: string,
        payload: { name: string; description: string },
    ): JobRecord {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        this.databaseService
            .getDatabase()
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
                ) VALUES (
                    @id,
                    @name,
                    @description,
                    @is_completed,
                    @is_pending,
                    @created_at,
                    @updated_at,
                    @started_at,
                    @finished_at,
                    @error_message,
                    @created_by
                )
                `,
            )
            .run({
                id,
                name: payload.name,
                description: payload.description,
                is_completed: 0,
                is_pending: 1,
                created_at: now,
                updated_at: now,
                started_at: now,
                finished_at: null,
                error_message: null,
                created_by: createdBy,
            });

        const nextJob = this.getJobById(id, createdBy);

        if (!nextJob) {
            throw new Error("Failed to create job");
        }

        return nextJob;
    }

    addJobEvent(
        createdBy: string,
        jobId: string,
        message: string,
        tag: JobEventTag,
    ): JobEventRecord {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO jobs_events (id, job_id, message, tag, created_at, created_by)
                VALUES (@id, @job_id, @message, @tag, @created_at, @created_by)
                `,
            )
            .run({
                id,
                job_id: jobId,
                message,
                tag,
                created_at: now,
                created_by: createdBy,
            });

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE jobs
                SET updated_at = @updated_at
                WHERE id = @job_id AND created_by = @created_by
                `,
            )
            .run({
                updated_at: now,
                job_id: jobId,
                created_by: createdBy,
            });

        const row = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM jobs_events
                WHERE id = @id
                LIMIT 1
                `,
            )
            .get({ id }) as RawJobEventData | undefined;

        if (!row) {
            throw new Error("Failed to create job event");
        }

        return mapJobEvent(row);
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
        const existing = this.getJobById(jobId, createdBy);

        if (!existing) {
            return null;
        }

        const now = new Date().toISOString();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE jobs
                SET
                    is_completed = @is_completed,
                    is_pending = @is_pending,
                    finished_at = @finished_at,
                    error_message = @error_message,
                    updated_at = @updated_at
                WHERE id = @id AND created_by = @created_by
                `,
            )
            .run({
                id: jobId,
                created_by: createdBy,
                is_completed:
                    payload.isCompleted === undefined
                        ? existing.isCompleted
                            ? 1
                            : 0
                        : payload.isCompleted
                          ? 1
                          : 0,
                is_pending:
                    payload.isPending === undefined
                        ? existing.isPending
                            ? 1
                            : 0
                        : payload.isPending
                          ? 1
                          : 0,
                finished_at:
                    payload.finishedAt === undefined
                        ? existing.finishedAt
                        : payload.finishedAt,
                error_message:
                    payload.errorMessage === undefined
                        ? existing.errorMessage
                        : payload.errorMessage,
                updated_at: now,
            });

        return this.getJobById(jobId, createdBy);
    }

    markPendingJobsAsInterrupted(createdBy: string): string[] {
        const pendingIds = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT id
                FROM jobs
                WHERE created_by = ? AND is_pending = 1
                `,
            )
            .all(createdBy) as Array<{ id: string }>;

        if (pendingIds.length === 0) {
            return [];
        }

        const now = new Date().toISOString();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE jobs
                SET
                    is_pending = 0,
                    is_completed = 0,
                    finished_at = @finished_at,
                    error_message = @error_message,
                    updated_at = @updated_at
                WHERE created_by = @created_by AND is_pending = 1
                `,
            )
            .run({
                created_by: createdBy,
                finished_at: now,
                error_message: "Задача прервана из-за перезапуска приложения",
                updated_at: now,
            });

        return pendingIds.map((row) => row.id);
    }
}
