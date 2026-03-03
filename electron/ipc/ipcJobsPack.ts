import type { JobService } from "../services/jobs/JobService";
import type { CreateJobPayload } from "../../src/types/ElectronApi";
import { handleManyIpc } from "./ipcUtils";

export type IpcJobsPackDeps = {
    jobService: JobService;
};

export const registerIpcJobsPack = ({ jobService }: IpcJobsPackDeps) => {
    handleManyIpc([
        ["app:get-jobs", () => jobService.getJobs()],
        ["app:get-job-by-id", (jobId: string) => jobService.getJobById(jobId)],
        [
            "app:get-job-events",
            (jobId: string) => jobService.getJobEvents(jobId),
        ],
        [
            "app:create-job",
            (payload: CreateJobPayload) => jobService.createJob(payload),
        ],
        ["app:cancel-job", (jobId: string) => jobService.cancelJob(jobId)],
    ]);
};
