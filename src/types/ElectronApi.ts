import type {
    AppExtensionInfo,
    BootData,
    ThemeData,
    ThemeListItem,
    UserProfile,
} from "./App";
import type {
    BuiltinToolPackage,
    ChatDialog,
    ChatDialogListItem,
    DeleteDialogResult,
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

export type TelegramParseMode = "Markdown" | "MarkdownV2" | "HTML";

export type SendTelegramMessagePayload = {
    telegramBotToken: string;
    telegramId: string;
    message: string;
    parseMode: TelegramParseMode;
};

export type SendTelegramMessageResult = {
    success: boolean;
    message: string;
    error?: string;
    message_id?: number;
};

export type GetUnreadTelegramMessagesPayload = {
    telegramBotToken: string;
    telegramId: string;
    limit?: number;
    markAsRead?: boolean;
};

export type TelegramUserMessage = {
    update_id: number;
    message_id?: number;
    date?: number;
    text: string;
    chat: {
        id?: number | string;
        type?: string;
        title?: string;
        username?: string;
        first_name?: string;
        last_name?: string;
    };
    from: {
        id?: number;
        is_bot?: boolean;
        first_name?: string;
        last_name?: string;
        username?: string;
        language_code?: string;
    };
};

export type GetUnreadTelegramMessagesResult = {
    success: boolean;
    message: string;
    error?: string;
    unread_count?: number;
    updates_count?: number;
    offset_used?: number;
    next_offset?: number;
    messages?: TelegramUserMessage[];
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
    getDialogContextById: (dialogId: string) => Promise<ChatDialog>;
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
    updateProjectVectorStorage: (
        projectId: string,
        vecStorId: string | null,
    ) => Promise<Project | null>;
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
    updateVectorStorage: (
        vectorStorageId: string,
        payload: UpdateVectorStoragePayload,
    ) => Promise<VectorStorageRecord | null>;
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

export type AppApiCommunicationsNamespace = {
    sendTelegramMessage: (
        payload: SendTelegramMessagePayload,
    ) => Promise<SendTelegramMessageResult>;
    getUnreadTelegramMessages: (
        payload: GetUnreadTelegramMessagesPayload,
    ) => Promise<GetUnreadTelegramMessagesResult>;
};

export type AppApiExtensionsNamespace = {
    getExtensionsState: () => Promise<AppExtensionInfo[]>;
};

export type AppApiToolsNamespace = {
    getBuiltinToolPackages: () => Promise<BuiltinToolPackage[]>;
};

export type StreamOllamaChatPayload = {
    model: string;
    messages: OllamaMessage[];
    tools?: OllamaToolDefinition[];
    format?: OllamaResponseFormat;
    think?: boolean;
};

export type ChatRuntimeContext = {
    activeProjectId?: string;
    projectDirectory?: string;
    projectVectorStorageId?: string;
    currentDate?: string;
    zvsAccessToken?: string;
    zvsBaseUrl?: string;
    telegramId?: string;
    telegramBotToken?: string;
};

export type RunChatSessionPayload = {
    sessionId: string;
    model: string;
    messages: OllamaMessage[];
    enabledToolNames?: string[];
    format?: OllamaResponseFormat;
    think?: boolean;
    maxToolCalls?: number;
    runtimeContext?: ChatRuntimeContext;
};

export type ResolveCommandApprovalPayload = {
    callId: string;
    accepted: boolean;
};

export type ChatSessionEvent =
    | {
          sessionId: string;
          type: "thinking.delta";
          chunkText: string;
      }
    | {
          sessionId: string;
          type: "content.delta";
          chunkText: string;
      }
    | {
          sessionId: string;
          type: "tool.call";
          callId: string;
          toolName: string;
          args: Record<string, unknown>;
      }
    | {
          sessionId: string;
          type: "tool.result";
          callId: string;
          toolName: string;
          docId?: string;
          args: Record<string, unknown>;
          result: unknown;
      }
    | {
          sessionId: string;
          type: "usage";
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
      }
    | {
          sessionId: string;
          type: "done";
      }
    | {
          sessionId: string;
          type: "error";
          message: string;
      };

export type AppApiLlmNamespace = {
    runChatSession: (payload: RunChatSessionPayload) => Promise<void>;
    cancelChatSession: (sessionId: string) => Promise<boolean>;
    resolveCommandApproval: (
        payload: ResolveCommandApprovalPayload,
    ) => Promise<boolean>;
    onChatEvent: (listener: (event: ChatSessionEvent) => void) => () => void;
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

export type AppApi = {
    boot: AppApiBootNamespace;
    themes: AppApiThemesNamespace;
    profile: AppApiProfileNamespace;
    dialogs: AppApiDialogsNamespace;
    upload: AppApiUploadNamespace;
    files: AppApiFilesNamespace;
    projects: AppApiProjectsNamespace;
    scenarios: AppApiScenariosNamespace;
    vectorStorages: AppApiVectorStoragesNamespace;
    cache: AppApiCacheNamespace;
    jobs: AppApiJobsNamespace;
    network: AppApiNetworkNamespace;
    communications: AppApiCommunicationsNamespace;
    extensions: AppApiExtensionsNamespace;
    tools: AppApiToolsNamespace;
    llm: AppApiLlmNamespace;
    voice: AppApiVoiceNamespace;
};
