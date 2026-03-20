import { User } from "../../repositories/UserRepository";

export const defaultUser: Omit<User, "id" | "createdAt" | "updatedAt"> = {
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
