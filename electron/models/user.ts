export type AllowedChatProviders = "ollama";
export type AllowedWebToolsProviders = "ollama" | "searchapi";
export type AllowedEmbeddingsProviders = "ollama";
export type AssistantMode = "chat" | "planning" | "agent";

export interface ProviderConfig {
    baseUrl?: string;
    modelName?: string;
    apiKey: string;
}

export interface GeneralUserData {
    // Настройки ассистента
    selectedAssistantMode: AssistantMode;
    chatGenProvider: AllowedChatProviders;
    webToolsProvider: AllowedWebToolsProviders;
    embeddingsProvider: AllowedEmbeddingsProviders;
    maxToolsUsagePerResponse: number;
    assistantName: string;
    enabledPromptTools: string[];
    requiredPromptTools: string[];
    userPrompt: string;
    // Персонализация
    name: string;
    isExtendedInterfaceModeEnabled: boolean;
    preferredTheme: string;
    preferredLanguage: string;
    // Уведомления
    notifyOnJobCompleteToast: boolean;
    notifyOnJobCompleteOsNotification: boolean;
    notifyOnJobCompleteEmail: boolean;
}

export interface SecureUserData {
    // Провайдеры
    chatGenProviders: Record<AllowedChatProviders, ProviderConfig>;
    webToolsProviders: Record<AllowedWebToolsProviders, ProviderConfig>;
    embeddingsProviders: Record<AllowedEmbeddingsProviders, ProviderConfig>;
}

export interface User {
    id: string;
    isCurrent: boolean;
    generalData: GeneralUserData;
    secureData: SecureUserData;
    createdAt: string;
    updatedAt: string;
}

export type CreateUserDto = Omit<User, "id" | "createdAt" | "updatedAt">;

export type UpdateUserDto = Partial<
    Omit<User, "id" | "createdAt" | "updatedAt" | "isCurrent">
>;
