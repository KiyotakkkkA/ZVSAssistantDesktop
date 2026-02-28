import { useCallback } from "react";
import { useObserver } from "mobx-react-lite";
import { userProfileStore } from "../stores/userProfileStore";
import type { UserProfile } from "../types/App";

type ChatSettingsFields = Pick<
    UserProfile,
    | "chatDriver"
    | "ollamaModel"
    | "ollamaEmbeddingModel"
    | "ollamaToken"
    | "mistralVoiceRecModel"
    | "mistralToken"
    | "voiceRecognitionDriver"
    | "embeddingDriver"
    | "telegramId"
    | "telegramBotToken"
    | "assistantName"
    | "useSpeechSynthesis"
    | "maxToolCallsPerResponse"
>;

export const useChatParams = () => {
    const updateChatParams = useCallback(
        async (nextParams: Partial<ChatSettingsFields>) => {
            await userProfileStore.updateUserProfile(nextParams);
        },
        [],
    );

    return useObserver(() => ({
        isReady: userProfileStore.isReady,
        userProfile: userProfileStore.userProfile,
        updateChatParams,
    }));
};
