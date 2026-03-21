import type { CreateUserDto } from "../../models/user";

export const defaultUser: CreateUserDto = {
    isCurrent: true,
    generalData: {
        // Персонализация
        preferredTheme: "dark-main",
        // Настройки взаимодействия в чате
        name: "Пользователь",
        preferredLanguage: "",
        userPrompt: "",
    },
    secureData: {
        ollamaApiKey: "",
    },
};
