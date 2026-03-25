export interface GeneralUserData {
    name: string;
    maxToolsUsagePerResponse: number;
    assistantName: string;
    ollamaModel: string;
    enabledPromptTools: string[];
    requiredPromptTools: string[];
    preferredTheme: string;
    preferredLanguage: string;
    userPrompt: string;
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
