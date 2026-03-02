import type {
    CreateJobPayload,
    JobEventRecord,
    JobEventTag,
    JobRecord,
} from "../../../src/types/ElectronApi";
import { DatabaseService } from "../storage/DatabaseService";
import { UserProfileService } from "../userData/UserProfileService";

export class JobsStorage {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly userProfileService: UserProfileService,
    ) {}

    private getCurrentUserId(): string {
        return this.userProfileService.getCurrentUserId();
    }

    getJobs(): JobRecord[] {
        return this.databaseService.getJobs(this.getCurrentUserId());
    }

    getJobById(jobId: string): JobRecord | null {
        return this.databaseService.getJobById(jobId, this.getCurrentUserId());
    }

    getJobEvents(jobId: string): JobEventRecord[] {
        return this.databaseService.getJobEvents(
            jobId,
            this.getCurrentUserId(),
        );
    }

    createJob(payload: CreateJobPayload): JobRecord {
        const name = payload.name.trim() || "Фоновая задача";
        const description = payload.description?.trim() || "";

        return this.databaseService.createJob(this.getCurrentUserId(), {
            name,
            description,
        });
    }

    appendJobEvent(
        jobId: string,
        message: string,
        tag: JobEventTag,
    ): JobEventRecord {
        return this.databaseService.addJobEvent(
            this.getCurrentUserId(),
            jobId,
            message,
            tag,
        );
    }

    updateJob(
        jobId: string,
        payload: {
            isCompleted?: boolean;
            isPending?: boolean;
            finishedAt?: string | null;
            errorMessage?: string | null;
        },
    ): JobRecord | null {
        return this.databaseService.updateJob(
            jobId,
            this.getCurrentUserId(),
            payload,
        );
    }

    markPendingJobsAsInterrupted(): string[] {
        return this.databaseService.markPendingJobsAsInterrupted(
            this.getCurrentUserId(),
        );
    }
}
