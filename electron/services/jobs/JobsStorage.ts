import type {
    CreateJobPayload,
    JobEventRecord,
    JobEventTag,
    JobRecord,
} from "../../models/job";
import type { JobRepository } from "../../repositories/JobRepository";
import type { UserRepository } from "../../repositories/UserRepository";

export class JobsStorage {
    constructor(
        private readonly jobRepository: JobRepository,
        private readonly userRepository: UserRepository,
    ) {}

    private getCurrentUserId(): string {
        const currentUser = this.userRepository.findCurrentUser();

        if (!currentUser) {
            throw new Error("Current user is not found");
        }

        return currentUser.id;
    }

    getJobs(): JobRecord[] {
        return this.jobRepository.getJobs(this.getCurrentUserId());
    }

    getJobById(jobId: string): JobRecord | null {
        return this.jobRepository.getJobById(jobId, this.getCurrentUserId());
    }

    getJobEvents(jobId: string): JobEventRecord[] {
        return this.jobRepository.getJobEvents(jobId, this.getCurrentUserId());
    }

    createJob(payload: CreateJobPayload): JobRecord {
        const name = payload.name.trim() || "Фоновая задача";
        const description = payload.description?.trim() || "";

        return this.jobRepository.createJob(this.getCurrentUserId(), {
            name,
            description,
        });
    }

    appendJobEvent(
        jobId: string,
        message: string,
        tag: JobEventTag,
    ): JobEventRecord {
        return this.jobRepository.addJobEvent(
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
        return this.jobRepository.updateJob(
            jobId,
            this.getCurrentUserId(),
            payload,
        );
    }

    markPendingJobsAsInterrupted(): string[] {
        return this.jobRepository.markPendingJobsAsInterrupted(
            this.getCurrentUserId(),
        );
    }
}
