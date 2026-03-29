import type { CreateUserDto } from "../../models/user";

export const defaultUser: CreateUserDto = {
    isCurrent: true,
    generalData: {
        // Настройким ассистента
        assistantName: "Чарли",
        ollamaModel: "gpt-oss:20b",
        maxToolsUsagePerResponse: 20,
        enabledPromptTools: [],
        requiredPromptTools: [],
        // Персонализация
        name: "Пользователь",
        isExtendedInterfaceModeEnabled: false,
        preferredLanguage: "",
        preferredTheme: "dark-main",
        userPrompt: "",
        // Уведомления
        notifyOnJobCompleteToast: true,
        notifyOnJobCompleteOsNotification: false,
        notifyOnJobCompleteEmail: false,
    },
    secureData: {
        ollamaApiKey: "",
    },
};
