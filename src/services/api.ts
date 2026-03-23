import { Config } from "../../electron/config";
import type {
    CreateJobPayload,
    JobEventRecord,
    JobRealtimeEvent,
    JobRecord,
} from "../types/ElectronApi";

export type OllamaCatalogModelDetails = {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
};

export type OllamaCatalogModel = {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: OllamaCatalogModelDetails;
};

export const getOllamaModelsCatalog = async (): Promise<
    OllamaCatalogModel[]
> => {
    const rawResponse = await window.core.httpRequest(
        `${Config.OLLAMA_BASE_URL}/api/tags`,
        {
            method: "GET",
        },
    );

    const parsed = JSON.parse(rawResponse) as {
        models?: OllamaCatalogModel[];
    };

    return parsed.models ?? [];
};

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
