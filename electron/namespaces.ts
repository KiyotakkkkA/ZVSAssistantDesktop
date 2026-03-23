import type { ResponseGenParams } from "./models/chat";
import type {
    CreateDialogDto,
    DialogEntity,
    DialogId,
    UpdateDialogStateDto,
} from "./models/dialog";
import type { ProfileBootPayload } from "./models/profile";
import type { UpdateUserDto } from "./models/user";
import type { ThemeData } from "./static/themes/types";
import type {
    CreateJobPayload,
    JobEventRecord,
    JobRealtimeEvent,
    JobRecord,
} from "./models/job";

export type ChatStreamEventPayload = {
    requestId: string;
    part: {
        type: string;
        text?: string;
        error?: string;
        usage?: unknown;
        [key: string]: unknown;
    };
};

export interface IpcCoreNamespace {
    httpRequest(url: string, options?: RequestInit): Promise<string>;
    showOsNotification(params: {
        title: string;
        body: string;
    }): Promise<boolean>;
}

export interface IpcChatNamespace {
    generateResponse(params: ResponseGenParams): Promise<{
        text: string;
        usage: unknown;
    }>;
    streamResponseGeneration(
        params: ResponseGenParams & { requestId: string },
    ): void;
    onStreamEvent(
        listener: (payload: ChatStreamEventPayload) => void,
    ): () => void;
}

export interface IpcProfileNamespace {
    boot(): Promise<ProfileBootPayload>;
    update(id: string, data: UpdateUserDto): Promise<ProfileBootPayload>;
    getThemeData(themeName: string): Promise<ThemeData>;
}

export interface IpcWorkspaceNamespace {
    getDialogs(): Promise<DialogEntity[]>;
    createDialog(dialog: CreateDialogDto): Promise<DialogEntity>;
    renameDialog(id: DialogId, name: string): Promise<void>;
    deleteDialog(id: DialogId): Promise<void>;
    updateDialogState(payload: UpdateDialogStateDto): Promise<void>;
}

export interface IpcJobsNamespace {
    getJobs(): Promise<JobRecord[]>;
    getJobById(jobId: string): Promise<JobRecord | null>;
    getJobEvents(jobId: string): Promise<JobEventRecord[]>;
    createJob(payload: CreateJobPayload): Promise<JobRecord>;
    cancelJob(jobId: string): Promise<boolean>;
    onRealtimeEvent(listener: (event: JobRealtimeEvent) => void): () => void;
}
