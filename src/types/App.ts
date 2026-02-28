export type ChatDriver = "" | "ollama";
export type VoiceRecognitionDriver = "" | "mistral";
export type EmbeddingDriver = "" | "ollama";

export type WorkspaceTab = "dialogs" | "projects" | "scenario";

export type AppExtensionInfo = {
    id: string;
    title: string;
    description: string;
    repositoryUrl: string;
    releaseZipUrl: string;
    installPath: string;
    entryFilePath: string;
    isInstalled: boolean;
};

export type UserProfile = {
    themePreference: string;
    ollamaModel: string;
    ollamaEmbeddingModel: string;
    ollamaToken: string;
    mistralVoiceRecModel: string;
    mistralToken: string;
    voiceRecognitionDriver: VoiceRecognitionDriver;
    embeddingDriver: EmbeddingDriver;
    telegramId: string;
    telegramBotToken: string;
    chatDriver: ChatDriver;
    assistantName: string;
    useSpeechSynthesis: boolean;
    maxToolCallsPerResponse: number;
    userName: string;
    userPrompt: string;
    userLanguage: string;
    activeDialogId: string | null;
    activeProjectId: string | null;
    activeScenarioId: string | null;
    lastActiveTab: WorkspaceTab;
};

export type ThemeData = {
    id: string;
    name: string;
    palette: Record<string, string>;
};

export type ThemeListItem = {
    id: string;
    name: string;
};

export type BootData = {
    userProfile: UserProfile;
    preferredThemeData: Record<string, string>;
    extensions: AppExtensionInfo[];
};
