export interface GeneralUserData {
    // Настройки ассистента
    maxToolsUsagePerResponse: number;
    assistantName: string;
    ollamaModel: string;
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
    ollamaApiKey: string;
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
