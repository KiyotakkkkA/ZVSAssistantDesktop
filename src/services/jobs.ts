import {
    CreateJobPayload,
    JobEventRecord,
    JobRealtimeEvent,
    JobRecord,
} from "../types/ElectronApi";

export const getJobs = async (): Promise<JobRecord[]> => {
    return window.jobs.getJobs();
};

export const getJobById = async (jobId: string): Promise<JobRecord | null> => {
    return window.jobs.getJobById(jobId);
};

export const getJobEvents = async (
    jobId: string,
): Promise<JobEventRecord[]> => {
    return window.jobs.getJobEvents(jobId);
};

export const createJob = async (
    payload: CreateJobPayload,
): Promise<JobRecord> => {
    return window.jobs.createJob(payload);
};

export const cancelJob = async (jobId: string): Promise<boolean> => {
    return window.jobs.cancelJob(jobId);
};

export const subscribeJobsRealtime = (
    listener: (event: JobRealtimeEvent) => void,
): (() => void) => {
    return window.jobs.onRealtimeEvent(listener);
};
