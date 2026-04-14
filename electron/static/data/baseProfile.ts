import { Config } from "../../config";
import type { CreateUserDto } from "../../models/user";

export const defaultUser: CreateUserDto = {
    isCurrent: true,
    generalData: {
        // Настройким ассистента
        selectedAssistantMode: "chat",
        assistantName: "Чарли",
        chatGenProvider: "ollama",
        webToolsProvider: "ollama",
        embeddingsProvider: "ollama",
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
                baseUrl: Config.OLLAMA_BASE_URL,
                modelName: "gpt-oss:20b",
                apiKey: "",
            },
        },
        webToolsProviders: {
            ollama: {
                baseUrl: Config.OLLAMA_BASE_URL,
                apiKey: "",
            },
            searchapi: {
                apiKey: "",
            },
        },
        embeddingsProviders: {
            ollama: {
                baseUrl: Config.OLLAMA_BASE_URL,
                modelName: "nomic-embed-text:latest",
                apiKey: "",
            },
        },
    },
};
