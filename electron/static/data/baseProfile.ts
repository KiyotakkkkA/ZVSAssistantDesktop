import type { CreateUserDto } from "../../models/user";

export const defaultUser: CreateUserDto = {
    isCurrent: true,
    generalData: {
        // Настройким ассистента
        assistantName: "Чарли",
        chatGenProvider: "ollama",
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
        chatGenProviders: {
            ollama: {
                baseUrl: "https://ollama.com",
                modelName: "gpt-oss:20b",
                apiKey: "",
            },
        },
    },
};
