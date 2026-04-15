import type { ResponseGenParams } from "./models/chat";
import type {
    CreateDialogDto,
    DialogEntity,
    UpdateDialogStateDto,
} from "./models/dialog";
import type {
    AddStorageFileDto,
    CreateStorageFolderDto,
    StorageFileEntity,
    StorageFolderEntity,
} from "./models/storage";
import type { CreateSecretDto, SecretEntity } from "./models/secret";
import type { ProfileBootPayload } from "./models/profile";
import type { UpdateUserDto } from "./models/user";
import type { ThemeData } from "./static/themes/types";
import type {
    CreateJobPayload,
    JobEventRecord,
    JobRealtimeEvent,
    JobRecord,
} from "./models/job";
import { DialogIdFormat } from "../src/utils/creators";

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
    openExternal(url: string): Promise<{
        success: boolean;
        result?: string;
        error?: string;
    }>;
    openPath(path: string): Promise<{
        success: boolean;
        result?: string;
        error?: string;
    }>;
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
    renameDialog(id: DialogIdFormat, name: string): Promise<void>;
    deleteDialog(id: DialogIdFormat): Promise<void>;
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

export interface IpcStorageNamespace {
    getStorageFolders(): Promise<StorageFolderEntity[]>;
    getStorageFiles(): Promise<StorageFileEntity[]>;
    createStorageFolder(
        payload: CreateStorageFolderDto,
    ): Promise<StorageFolderEntity>;
    renameStorageFolder(
        id: string,
        name: string,
    ): Promise<StorageFolderEntity | null>;
    deleteStorageFolder(id: string): Promise<void>;
    addFilesToFolder(
        folderId: string,
        files: AddStorageFileDto[],
    ): Promise<StorageFileEntity[]>;
    removeFilesFromFolder(folderId: string, fileIds: string[]): Promise<void>;
    refreshFolderContent(folderId: string): Promise<StorageFileEntity[]>;
}

export interface IpcSecretsNamespace {
    getSecrets(): Promise<SecretEntity[]>;
    getSecretsByType(type: string): Promise<SecretEntity[]>;
    createSecret(payload: CreateSecretDto): Promise<SecretEntity>;
    deleteSecret(id: string): Promise<void>;
}
