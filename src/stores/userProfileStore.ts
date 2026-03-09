import { makeAutoObservable, runInAction } from "mobx";
import type { UserProfile } from "../types/App";
import { extensionsStore } from "./extensionsStore";

const DEFAULT_THEME_ID = "dark-main";
const DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "embeddinggemma";
const DEFAULT_MISTRAL_VOICE_REC_MODEL = "";

class UserProfileStore {
    isReady = false;
    userProfile: UserProfile = {
        themePreference: DEFAULT_THEME_ID,
        ollamaModel: DEFAULT_OLLAMA_MODEL,
        ollamaEmbeddingModel: DEFAULT_OLLAMA_EMBEDDING_MODEL,
        ollamaToken: "",
        mistralVoiceRecModel: DEFAULT_MISTRAL_VOICE_REC_MODEL,
        mistralToken: "",
        voiceRecognitionDriver: "",
        embeddingDriver: "",
        telegramId: "",
        telegramBotToken: "",
        chatDriver: "ollama",
        assistantName: "Чарли",
        notifyOnJobCompleteToast: true,
        notifyOnJobCompleteTelegram: false,
        notifyOnJobCompleteEmail: false,
        piperModelPath: "",
        maxToolCallsPerResponse: 4,
        userName: "Пользователь",
        userPrompt: "",
        userLanguage: "Русский",
        zvsAuthUserId: "",
        zvsAuthLogin: "",
        zvsAuthEmail: "",
        zvsAuthName: "",
        zvsAuthUpdatedAt: "",
        useSpeechSynthesis: false,
        activeDialogId: null,
        activeProjectId: null,
        activeScenarioId: null,
        lastActiveTab: "dialogs",
    };

    private isInitializing = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async initialize(): Promise<void> {
        if (this.isReady || this.isInitializing) {
            return;
        }

        this.isInitializing = true;

        try {
            const api = window.appApi;

            if (!api) {
                runInAction(() => {
                    this.isReady = true;
                });
                return;
            }

            const bootData = await api.boot.getBootData();

            runInAction(() => {
                this.userProfile = bootData.userProfile;
                this.isReady = true;
            });

            extensionsStore.hydrateFromBootData(bootData.extensions);
        } finally {
            runInAction(() => {
                this.isInitializing = false;
            });
        }
    }

    async updateUserProfile(
        nextProfile: Partial<UserProfile>,
    ): Promise<UserProfile> {
        const api = window.appApi;

        if (!api) {
            runInAction(() => {
                this.userProfile = {
                    ...this.userProfile,
                    ...nextProfile,
                };
            });

            return this.userProfile;
        }

        const updatedProfile = await api.profile.updateUserProfile(nextProfile);

        runInAction(() => {
            this.userProfile = updatedProfile;
        });

        return updatedProfile;
    }
}

export const userProfileStore = new UserProfileStore();
