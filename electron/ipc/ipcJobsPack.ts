import { BrowserWindow } from "electron";
import type { CreateJobPayload } from "../models/job";
import type { JobRealtimeEvent } from "../models/job";
import type { JobService } from "../services/jobs/JobService";
import { handleManyIpc } from "./ipcUtils";

interface IpcJobsPackDeps {
    jobService: JobService;
}

export const registerIpcJobsPack = ({ jobService }: IpcJobsPackDeps) => {
    handleManyIpc([
        ["jobs:get", () => jobService.getJobs()],
        ["jobs:get-by-id", (jobId: string) => jobService.getJobById(jobId)],
        ["jobs:get-events", (jobId: string) => jobService.getJobEvents(jobId)],
        [
            "jobs:create",
            (payload: CreateJobPayload) => jobService.createJob(payload),
        ],
        ["jobs:cancel", (jobId: string) => jobService.cancelJob(jobId)],
    ]);
};

export const broadcastJobsRealtimeEvent = (event: JobRealtimeEvent) => {
    for (const windowInstance of BrowserWindow.getAllWindows()) {
        windowInstance.webContents.send("jobs:realtime:event", event);
    }
};
