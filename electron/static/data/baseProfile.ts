import type { CreateUserDto } from "../../models/user";

export const defaultUser: CreateUserDto = {
    isCurrent: true,
    generalData: {
        // Настройким ассистента
        assistantName: "Чарли",
        ollamaModel: "gpt-oss:20b",
        maxToolsUsagePerResponse: 20,
        // Персонализация
        preferredTheme: "dark-main",
        // Настройки взаимодействия в чате
        name: "Пользователь",
        preferredLanguage: "",
        userPrompt: "",
        // Уведомления о задачах
        notifyOnJobCompleteToast: true,
        notifyOnJobCompleteOsNotification: false,
        notifyOnJobCompleteEmail: false,
    },
    secureData: {
        ollamaApiKey: "",
    },
};
