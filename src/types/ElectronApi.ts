import type {
    AppExtensionInfo,
    BootData,
    ThemeData,
    ThemeListItem,
    UserProfile,
} from "./App";
import type {
    ChatDialog,
    ChatDialogListItem,
    DeleteDialogResult,
    OllamaChatChunk,
    OllamaMessage,
    OllamaResponseFormat,
    OllamaToolDefinition,
} from "./Chat";
import type {
    CreateProjectPayload,
    DeleteProjectResult,
    Project,
    ProjectListItem,
} from "./Project";
import type {
    CreateScenarioPayload,
    DeleteScenarioResult,
    Scenario,
    ScenarioListItem,
    UpdateScenarioPayload,
} from "./Scenario";

export type ExecShellCommandResult = {
    command: string;
    cwd: string;
    isAdmin: false;
    exitCode: number;
    stdout: string;
    stderr: string;
};

export type UploadedFileData = {
    name: string;
    mimeType: string;
    size: number;
    dataUrl: string;
};

export type FileManifestEntry = {
    path: string;
    originalName: string;
    size: number;
    savedAt: string;
};

export type SavedFileRecord = FileManifestEntry & {
    id: string;
};

export type JobEventTag = "info" | "success" | "warning" | "error";

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
};

export type JobEventRecord = {
    id: string;
    jobId: string;
    message: string;
    tag: JobEventTag;
    createdAt: string;
};

export type CreateJobPayload = {
    name: string;
    description?: string;
    kind?: "generic" | "vectorization" | "extension-install";
    vectorStorageId?: string;
    sourceDirectoryPath?: string;
    sourceFileIds?: string[];
    uploadedFiles?: UploadedFileData[];
    extensionId?: string;
    extensionReleaseZipUrl?: string;
    totalSteps?: number;
    stepDelayMs?: number;
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

export type VectorStorageUsedByProject = {
    id: string;
    title: string;
};

export type VectorTagRecord = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};

export type VectorStorageRecord = {
    id: string;
    name: string;
    size: number;
    dataPath: string;
    lastActiveAt: string;
    createdAt: string;
    fileIds: string[];
    tags: VectorTagRecord[];
    usedByProjects: VectorStorageUsedByProject[];
};

export type VectorStoreSearchHit = {
    id: string;
    text: string;
    fileId: string;
    fileName: string;
    chunkIndex: number;
    score: number;
};

export type UpdateVectorStoragePayload = {
    name?: string;
    size?: number;
    dataPath?: string;
    lastActiveAt?: string;
    fileIds?: string[];
    projectIds?: string[];
    tagIds?: string[];
};

export type SaveImageFromSourcePayload = {
    src: string;
    preferredFileName?: string;
};

export type SaveImageFromSourceResult = {
    savedPath: string;
    fileName: string;
    mimeType: string;
    size: number;
    sourceKind: "remote" | "local" | "data-url";
};

export type AppCacheEntry = {
    collectedAt: number;
    ttlSeconds: number;
    expiresAt: number;
    data: unknown;
};

export type ProxyHttpRequestPayload = {
    url: string;
    method: string;
    formatter?: string;
    headers?: Record<string, string>;
    bodyText?: string;
};

export type ProxyHttpRequestResult = {
    ok: boolean;
    status: number;
    statusText: string;
    bodyText: string;
};

export type AppApiBootNamespace = {
    getBootData: () => Promise<BootData>;
};

export type AppApiThemesNamespace = {
    getThemesList: () => Promise<ThemeListItem[]>;
    getThemeData: (themeId: string) => Promise<ThemeData>;
};

export type AppApiProfileNamespace = {
    updateUserProfile: (
        nextProfile: Partial<UserProfile>,
    ) => Promise<UserProfile>;
};

export type AppApiDialogsNamespace = {
    getActiveDialog: () => Promise<ChatDialog>;
    getDialogsList: () => Promise<ChatDialogListItem[]>;
    getDialogById: (dialogId: string) => Promise<ChatDialog>;
    createDialog: () => Promise<ChatDialog>;
    renameDialog: (dialogId: string, title: string) => Promise<ChatDialog>;
    deleteDialog: (dialogId: string) => Promise<DeleteDialogResult>;
    deleteMessageFromDialog: (
        dialogId: string,
        messageId: string,
    ) => Promise<ChatDialog>;
    truncateDialogFromMessage: (
        dialogId: string,
        messageId: string,
    ) => Promise<ChatDialog>;
    saveDialogSnapshot: (dialog: ChatDialog) => Promise<ChatDialog>;
};

export type AppApiShellNamespace = {
    execShellCommand: (
        command: string,
        cwd?: string,
    ) => Promise<ExecShellCommandResult>;
};

export type BrowserRedirect = {
    from: string;
    to: string;
};

export type BrowserNavigateResult = {
    success: boolean;
    requestedUrl: string;
    finalUrl: string;
    title: string;
    redirected: boolean;
    redirects: BrowserRedirect[];
    statusCode: number | null;
    loadTimeMs: number;
    error?: string;
};

export type BrowserSnapshotElement = {
    id: string;
    tag: string;
    role: string;
    text: string;
    href: string;
    type: string;
    placeholder: string;
    selector: string;
};

export type BrowserPageSnapshot = {
    url: string;
    title: string;
    headings: string[];
    elements: BrowserSnapshotElement[];
    textPreview: string;
    capturedAt: string;
};

export type BrowserInteractAction = "click" | "type";

export type BrowserInteractParams = {
    action: BrowserInteractAction;
    selector: string;
    text?: string;
    submit?: boolean;
    waitForNavigationMs?: number;
};

export type BrowserInteractResult = {
    success: boolean;
    action: BrowserInteractAction;
    selector: string;
    elementTag?: string;
    url: string;
    title: string;
    waitedMs: number;
    error?: string;
};

export type BrowserCloseResult = {
    success: boolean;
    hadSession: boolean;
};

export type AppApiBrowserNamespace = {
    openUrl: (
        url: string,
        timeoutMs?: number,
    ) => Promise<BrowserNavigateResult>;
    getPageSnapshot: (maxElements?: number) => Promise<BrowserPageSnapshot>;
    interactWith: (
        params: BrowserInteractParams,
    ) => Promise<BrowserInteractResult>;
    closeSession: () => Promise<BrowserCloseResult>;
};

export type AppApiUploadNamespace = {
    pickFiles: (options?: {
        accept?: string[];
        multiple?: boolean;
    }) => Promise<UploadedFileData[]>;
    pickPath: (options?: { forFolders?: boolean }) => Promise<string | null>;
};

export type AppApiFilesNamespace = {
    saveFiles: (files: UploadedFileData[]) => Promise<SavedFileRecord[]>;
    saveImageFromSource: (
        payload: SaveImageFromSourcePayload,
    ) => Promise<SaveImageFromSourceResult | null>;
    getAllFiles: () => Promise<SavedFileRecord[]>;
    getFilesByIds: (fileIds: string[]) => Promise<SavedFileRecord[]>;
    deleteFile: (fileId: string) => Promise<boolean>;
    openFile: (fileId: string) => Promise<boolean>;
    openPath: (targetPath: string) => Promise<boolean>;
    openExternalUrl: (url: string) => Promise<boolean>;
};

export type AppApiProjectsNamespace = {
    getProjectsList: () => Promise<ProjectListItem[]>;
    getDefaultProjectsDirectory: () => Promise<string>;
    getProjectById: (projectId: string) => Promise<Project | null>;
    createProject: (payload: CreateProjectPayload) => Promise<Project>;
    deleteProject: (projectId: string) => Promise<DeleteProjectResult>;
};

export type AppApiScenariosNamespace = {
    getScenariosList: () => Promise<ScenarioListItem[]>;
    getScenarioById: (scenarioId: string) => Promise<Scenario | null>;
    createScenario: (payload: CreateScenarioPayload) => Promise<Scenario>;
    updateScenario: (
        scenarioId: string,
        payload: UpdateScenarioPayload,
    ) => Promise<Scenario | null>;
    deleteScenario: (scenarioId: string) => Promise<DeleteScenarioResult>;
};

export type AppApiVectorStoragesNamespace = {
    getVectorStorages: () => Promise<VectorStorageRecord[]>;
    createVectorStorage: () => Promise<VectorStorageRecord>;
    getVectorTags: () => Promise<VectorTagRecord[]>;
    createVectorTag: (name: string) => Promise<VectorTagRecord | null>;
    updateVectorStorage: (
        vectorStorageId: string,
        payload: UpdateVectorStoragePayload,
    ) => Promise<VectorStorageRecord | null>;
    deleteVectorStorage: (vectorStorageId: string) => Promise<boolean>;
    searchVectorStorage: (
        vectorStorageId: string,
        query: string,
        limit?: number,
    ) => Promise<VectorStoreSearchHit[]>;
};

export type AppApiCacheNamespace = {
    getCacheEntry: (key: string) => Promise<AppCacheEntry | null>;
    setCacheEntry: (key: string, entry: AppCacheEntry) => Promise<void>;
};

export type AppApiJobsNamespace = {
    getJobs: () => Promise<JobRecord[]>;
    getJobById: (jobId: string) => Promise<JobRecord | null>;
    getJobEvents: (jobId: string) => Promise<JobEventRecord[]>;
    createJob: (payload: CreateJobPayload) => Promise<JobRecord>;
    cancelJob: (jobId: string) => Promise<boolean>;
    onJobEvent: (listener: (event: JobRealtimeEvent) => void) => () => void;
};

export type AppApiNetworkNamespace = {
    proxyHttpRequest: (
        payload: ProxyHttpRequestPayload,
    ) => Promise<ProxyHttpRequestResult>;
};

export type AppApiExtensionsNamespace = {
    getExtensionsState: () => Promise<AppExtensionInfo[]>;
};

export type StreamOllamaChatPayload = {
    model: string;
    messages: OllamaMessage[];
    tools?: OllamaToolDefinition[];
    format?: OllamaResponseFormat;
    think?: boolean;
};

export type AppApiLlmNamespace = {
    streamOllamaChat: (
        payload: StreamOllamaChatPayload,
    ) => Promise<OllamaChatChunk[]>;
};

export type StartMistralRealtimeTranscriptionPayload = {
    apiKey: string;
    model: string;
    sampleRate: number;
};

export type VoiceTranscriptionEvent =
    | {
          sessionId: string;
          type: "transcription.text.delta";
          text: string;
      }
    | {
          sessionId: string;
          type: "transcription.done";
      }
    | {
          sessionId: string;
          type: "error";
          message: string;
      };

export type AppApiVoiceNamespace = {
    startMistralRealtimeTranscription: (
        payload: StartMistralRealtimeTranscriptionPayload,
    ) => Promise<{ sessionId: string }>;
    pushRealtimeTranscriptionChunk: (
        sessionId: string,
        chunk: Uint8Array,
    ) => Promise<void>;
    stopRealtimeTranscription: (sessionId: string) => Promise<void>;
    synthesizeSpeechWithPiper: (text: string) => Promise<Uint8Array>;
    onRealtimeTranscriptionEvent: (
        listener: (event: VoiceTranscriptionEvent) => void,
    ) => () => void;
};

export type FsDirectoryEntry = {
    name: string;
    type: "file" | "directory";
    size: number;
    modifiedAt: string;
};

export type FsListDirectoryResult = {
    path: string;
    entries: FsDirectoryEntry[];
};

export type FsCreateFileResult = {
    success: boolean;
    path: string;
};

export type FsCreateDirResult = {
    success: boolean;
    path: string;
};

export type FsReadFileResult = {
    path: string;
    content: string;
    totalLines: number;
    fromLine: number;
    toLine: number;
};

export type AppApiFsNamespace = {
    listDirectory: (cwd: string) => Promise<FsListDirectoryResult>;
    createFile: (
        cwd: string,
        filename: string,
        content?: string,
    ) => Promise<FsCreateFileResult>;
    createDir: (cwd: string, dirname: string) => Promise<FsCreateDirResult>;
    readFile: (
        filePath: string,
        readAll: boolean,
        fromLine?: number,
        toLine?: number,
    ) => Promise<FsReadFileResult>;
};

export type AppApi = {
    boot: AppApiBootNamespace;
    themes: AppApiThemesNamespace;
    profile: AppApiProfileNamespace;
    dialogs: AppApiDialogsNamespace;
    shell: AppApiShellNamespace;
    browser: AppApiBrowserNamespace;
    upload: AppApiUploadNamespace;
    files: AppApiFilesNamespace;
    projects: AppApiProjectsNamespace;
    scenarios: AppApiScenariosNamespace;
    vectorStorages: AppApiVectorStoragesNamespace;
    cache: AppApiCacheNamespace;
    jobs: AppApiJobsNamespace;
    network: AppApiNetworkNamespace;
    extensions: AppApiExtensionsNamespace;
    llm: AppApiLlmNamespace;
    voice: AppApiVoiceNamespace;
    fs: AppApiFsNamespace;
};
