export type AllowedProviders = "ollama";

export interface ChatGenProviderConfig {
    baseUrl?: string;
    modelName: string;
    apiKey: string;
}

export interface GeneralUserData {
    // Настройки ассистента
    chatGenProvider: AllowedProviders;
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
    chatGenProviders: Record<AllowedProviders, ChatGenProviderConfig>;
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
