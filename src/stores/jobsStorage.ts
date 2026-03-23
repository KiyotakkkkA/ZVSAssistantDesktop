import { makeAutoObservable, runInAction } from "mobx";
import type {
    CreateJobPayload,
    JobEventRecord,
    JobRealtimeEvent,
    JobRecord,
} from "../types/ElectronApi";
import {
    cancelJob,
    createJob,
    getJobById,
    getJobEvents,
    getJobs,
    subscribeJobsRealtime,
} from "../services/api";

class JobsStorage {
    isLoading = false;
    jobs: JobRecord[] = [];
    eventsByJobId: Record<string, JobEventRecord[]> = {};
    selectedJobId: string | null = null;

    private isInitializing = false;
    private unsubscribeFromEvents: (() => void) | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async initialize(): Promise<void> {
        if (this.isInitializing) {
            return;
        }

        this.isInitializing = true;

        runInAction(() => {
            this.isLoading = true;
        });

        try {
            const jobs = await getJobs();

            runInAction(() => {
                this.jobs = jobs;

                if (
                    this.selectedJobId &&
                    jobs.some((job) => job.id === this.selectedJobId)
                ) {
                    return;
                }

                this.selectedJobId = jobs[0]?.id ?? null;
            });

            if (this.selectedJobId) {
                await this.loadJobEvents(this.selectedJobId);
            }

            this.ensureRealtimeSubscription();
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });

            this.isInitializing = false;
        }
    }

    dispose(): void {
        if (this.unsubscribeFromEvents) {
            this.unsubscribeFromEvents();
            this.unsubscribeFromEvents = null;
        }
    }

    async refreshJobs(): Promise<void> {
        const jobs = await getJobs();

        runInAction(() => {
            this.jobs = jobs;

            if (
                this.selectedJobId &&
                jobs.some((job) => job.id === this.selectedJobId)
            ) {
                return;
            }

            this.selectedJobId = jobs[0]?.id ?? null;
        });
    }

    async loadJobEvents(jobId: string): Promise<void> {
        const events = await getJobEvents(jobId);

        runInAction(() => {
            this.eventsByJobId = {
                ...this.eventsByJobId,
                [jobId]: events,
            };
        });
    }

    setSelectedJobId(jobId: string): void {
        this.selectedJobId = jobId;
    }

    async createJob(payload: CreateJobPayload): Promise<JobRecord | null> {
        const createdJob = await createJob(payload);

        runInAction(() => {
            this.upsertJob(createdJob);
            this.selectedJobId = createdJob.id;
        });

        await this.loadJobEvents(createdJob.id);

        return createdJob;
    }

    async cancelJob(jobId: string): Promise<boolean> {
        const isCancelled = await cancelJob(jobId);

        if (!isCancelled) {
            return false;
        }

        const nextJob = await getJobById(jobId);

        if (nextJob) {
            runInAction(() => {
                this.upsertJob(nextJob);
            });
        }

        await this.loadJobEvents(jobId);

        return true;
    }

    getJobById(jobId: string): JobRecord | null {
        return this.jobs.find((job) => job.id === jobId) ?? null;
    }

    get selectedJob(): JobRecord | null {
        if (!this.selectedJobId) {
            return null;
        }

        return this.getJobById(this.selectedJobId);
    }

    get selectedJobEvents(): JobEventRecord[] {
        if (!this.selectedJobId) {
            return [];
        }

        return this.eventsByJobId[this.selectedJobId] ?? [];
    }

    private ensureRealtimeSubscription(): void {
        if (this.unsubscribeFromEvents) {
            return;
        }

        this.unsubscribeFromEvents = subscribeJobsRealtime((event) => {
            this.applyRealtimeEvent(event);
        });
    }

    private applyRealtimeEvent(event: JobRealtimeEvent): void {
        if (event.type === "job.updated") {
            runInAction(() => {
                this.upsertJob(event.job);
            });

            return;
        }

        runInAction(() => {
            const nextEvents = [
                event.event,
                ...(this.eventsByJobId[event.event.jobId] ?? []).filter(
                    (existingEvent) => existingEvent.id !== event.event.id,
                ),
            ];

            this.eventsByJobId = {
                ...this.eventsByJobId,
                [event.event.jobId]: nextEvents,
            };
        });
    }

    private upsertJob(nextJob: JobRecord): void {
        const withoutCurrent = this.jobs.filter((job) => job.id !== nextJob.id);
        this.jobs = [nextJob, ...withoutCurrent].sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
        );
    }
}

export const jobsStorage = new JobsStorage();
