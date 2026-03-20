import type { User } from "../../electron/repositories/UserRepository";
import type { ThemeData } from "../../electron/static/themes/types";

export {};

export type ProfileBootPayload = {
    user: User;
    themeData: {
        list: Omit<ThemeData, "palette">[];
        current: ThemeData;
    };
};

declare global {
    interface Window {
        chat?: {
            generateResponse: (params: {
                prompt: string;
                model: string;
                messages?: Array<{
                    role: "user" | "assistant";
                    content: string;
                }>;
            }) => Promise<{
                text: string;
                usage: unknown;
            }>;
            streamResponseGeneration: (params: {
                requestId: string;
                prompt: string;
                model: string;
                messages?: Array<{
                    role: "user" | "assistant";
                    content: string;
                }>;
            }) => void;
            onStreamEvent: (
                listener: (payload: {
                    requestId: string;
                    part: {
                        type: string;
                        text?: string;
                        error?: string;
                    };
                }) => void,
            ) => () => void;
        };
        profile?: {
            boot: () => Promise<ProfileBootPayload>;
            update: (
                id: string,
                data: {
                    generalData?: {
                        name: string;
                        preferredTheme: string;
                        preferredLanguage: string;
                        userPrompt: string;
                    };
                    secureData?: {
                        ollamaApiKey: string;
                    };
                },
            ) => Promise<ProfileBootPayload>;
            getThemeData: (themeName: string) => Promise<ThemeData>;
        };
    }
}
