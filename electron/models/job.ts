export type JobEventTag = "info" | "success" | "warning" | "error";

export type StorageRepositorySyncProvider = "github" | "gitlab";

export type StorageRepositorySyncPayload = {
    provider: StorageRepositorySyncProvider;
    repoUrl: string;
    branch: string;
    token?: string;
    ignorePatterns?: string[];
    folderName?: string;
};

export type JobKind = "test-task" | "storage-repository-sync";

export type JobRecord = {
    id: string;
    name: string;
    description: string;
    isCompleted: boolean;
    isPending: boolean;
    createdAt: string;
    updatedAt: string;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
    createdBy: string;
};

export type JobEventRecord = {
    id: string;
    jobId: string;
    message: string;
    tag: JobEventTag;
    createdAt: string;
    createdBy: string;
};

export type CreateJobPayload = {
    name: string;
    description?: string;
    kind?: JobKind;
    totalSteps?: number;
    stepDelayMs?: number;
    storageRepositorySync?: StorageRepositorySyncPayload;
};

export type JobRealtimeEvent =
    | {
          type: "job.updated";
          job: JobRecord;
      }
    | {
          type: "job.event.created";
          event: JobEventRecord;
      };
