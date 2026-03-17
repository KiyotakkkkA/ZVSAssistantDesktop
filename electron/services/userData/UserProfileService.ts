import { randomBytes, randomUUID } from "node:crypto";
import { defaultProfile } from "../../static/data";
import type {
    ChatDriver,
    UserProfile,
    VoiceRecognitionDriver,
    WorkspaceTab,
} from "../../../src/types/App";
import { DatabaseService } from "../storage/DatabaseService";
import { MetaService } from "../storage/MetaService";

const CHAT_DRIVERS = new Set<ChatDriver>(["ollama", ""]);
const VOICE_RECOGNITION_DRIVERS = new Set<VoiceRecognitionDriver>([
    "mistral",
    "",
]);
const WORKSPACE_TABS = new Set<WorkspaceTab>([
    "dialogs",
    "projects",
    "scenario",
]);

const isChatDriver = (value: unknown): value is ChatDriver => {
    return typeof value === "string" && CHAT_DRIVERS.has(value as ChatDriver);
};

const isWorkspaceTab = (value: unknown): value is WorkspaceTab => {
    return (
        typeof value === "string" && WORKSPACE_TABS.has(value as WorkspaceTab)
    );
};

const isVoiceRecognitionDriver = (
    value: unknown,
): value is VoiceRecognitionDriver => {
    return (
        typeof value === "string" &&
        VOICE_RECOGNITION_DRIVERS.has(value as VoiceRecognitionDriver)
    );
};

const normalizeNullableId = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeWorkspaceContext = (profile: UserProfile): UserProfile => {
    const inferredTab: WorkspaceTab = profile.activeScenarioId
        ? "scenario"
        : profile.activeProjectId
          ? "projects"
          : "dialogs";
    const lastActiveTab = profile.lastActiveTab || inferredTab;

    const normalizeByTab: Record<
        WorkspaceTab,
        (next: UserProfile) => UserProfile
    > = {
        dialogs: (next) => ({
            ...next,
            activeProjectId: null,
            activeScenarioId: null,
            lastActiveTab,
        }),
        projects: (next) => ({
            ...next,
            activeProjectId: normalizeNullableId(next.activeProjectId),
            activeScenarioId: null,
            lastActiveTab,
        }),
        scenario: (next) => ({
            ...next,
            activeDialogId: null,
            activeProjectId: null,
            activeScenarioId: normalizeNullableId(next.activeScenarioId),
            lastActiveTab,
        }),
    };

    return normalizeByTab[lastActiveTab](profile);
};

export class UserProfileService {
    private readonly currentUserId: string;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly metaService: MetaService,
    ) {
        this.currentUserId = this.ensureCurrentUserProfile();
    }

    getCurrentUserId(): string {
        return this.currentUserId;
    }

    getUserProfile(): UserProfile {
        const parsed = this.databaseService.getProfileRaw(
            this.currentUserId,
        ) as Partial<UserProfile> | null;

        if (!parsed || typeof parsed !== "object") {
            return defaultProfile;
        }

        const normalized: UserProfile = {
            ...defaultProfile,
            ...(typeof parsed.themePreference === "string"
                ? { themePreference: parsed.themePreference }
                : {}),
            ...(typeof parsed.ollamaModel === "string"
                ? { ollamaModel: parsed.ollamaModel }
                : {}),
            ...(typeof parsed.ollamaToken === "string"
                ? { ollamaToken: parsed.ollamaToken }
                : {}),
            ...(typeof parsed.mistralVoiceRecModel === "string"
                ? { mistralVoiceRecModel: parsed.mistralVoiceRecModel }
                : {}),
            ...(typeof parsed.mistralToken === "string"
                ? { mistralToken: parsed.mistralToken }
                : {}),
            ...(isVoiceRecognitionDriver(parsed.voiceRecognitionDriver)
                ? { voiceRecognitionDriver: parsed.voiceRecognitionDriver }
                : {}),
            ...(typeof parsed.telegramId === "string"
                ? { telegramId: parsed.telegramId }
                : {}),
            ...(typeof parsed.telegramBotToken === "string"
                ? { telegramBotToken: parsed.telegramBotToken }
                : {}),
            ...(isChatDriver(parsed.chatDriver)
                ? { chatDriver: parsed.chatDriver }
                : {}),
            ...(typeof parsed.assistantName === "string"
                ? { assistantName: parsed.assistantName }
                : {}),
            ...(typeof parsed.useSpeechSynthesis === "boolean"
                ? { useSpeechSynthesis: parsed.useSpeechSynthesis }
                : {}),
            ...(typeof parsed.useAutoToolCallingConfirmation === "boolean"
                ? {
                      useAutoToolCallingConfirmation:
                          parsed.useAutoToolCallingConfirmation,
                  }
                : {}),
            ...(typeof parsed.notifyOnJobCompleteToast === "boolean"
                ? { notifyOnJobCompleteToast: parsed.notifyOnJobCompleteToast }
                : {}),
            ...(typeof parsed.notifyOnJobCompleteTelegram === "boolean"
                ? {
                      notifyOnJobCompleteTelegram:
                          parsed.notifyOnJobCompleteTelegram,
                  }
                : {}),
            ...(typeof parsed.notifyOnJobCompleteEmail === "boolean"
                ? { notifyOnJobCompleteEmail: parsed.notifyOnJobCompleteEmail }
                : {}),
            ...(typeof parsed.piperModelPath === "string"
                ? { piperModelPath: parsed.piperModelPath }
                : {}),
            ...(typeof parsed.maxToolCallsPerResponse === "number" &&
            Number.isFinite(parsed.maxToolCallsPerResponse)
                ? {
                      maxToolCallsPerResponse: parsed.maxToolCallsPerResponse,
                  }
                : {}),
            ...(typeof parsed.userName === "string"
                ? { userName: parsed.userName }
                : {}),
            ...(typeof parsed.userPrompt === "string"
                ? { userPrompt: parsed.userPrompt }
                : {}),
            ...(typeof parsed.userLanguage === "string"
                ? { userLanguage: parsed.userLanguage }
                : {}),
            ...(typeof parsed.zvsAuthUserId === "string"
                ? { zvsAuthUserId: parsed.zvsAuthUserId }
                : {}),
            ...(typeof parsed.zvsAuthLogin === "string"
                ? { zvsAuthLogin: parsed.zvsAuthLogin }
                : {}),
            ...(typeof parsed.zvsAuthEmail === "string"
                ? { zvsAuthEmail: parsed.zvsAuthEmail }
                : {}),
            ...(typeof parsed.zvsAuthName === "string"
                ? { zvsAuthName: parsed.zvsAuthName }
                : {}),
            ...(typeof parsed.zvsAuthUpdatedAt === "string"
                ? { zvsAuthUpdatedAt: parsed.zvsAuthUpdatedAt }
                : {}),
            activeDialogId: normalizeNullableId(parsed.activeDialogId),
            activeProjectId: normalizeNullableId(parsed.activeProjectId),
            activeScenarioId: normalizeNullableId(parsed.activeScenarioId),
            lastActiveTab: isWorkspaceTab(parsed.lastActiveTab)
                ? parsed.lastActiveTab
                : defaultProfile.lastActiveTab,
        };

        return normalizeWorkspaceContext(normalized);
    }

    updateUserProfile(nextProfile: Partial<UserProfile>): UserProfile {
        const currentProfile = this.getUserProfile();
        const mergedProfile = normalizeWorkspaceContext({
            ...currentProfile,
            ...nextProfile,
        });

        this.databaseService.updateProfileRaw(
            this.currentUserId,
            mergedProfile,
        );
        return mergedProfile;
    }

    private ensureCurrentUserProfile(): string {
        const currentUserIdFromMeta = this.metaService.getCurrentUserId();

        if (
            currentUserIdFromMeta &&
            this.databaseService.hasProfile(currentUserIdFromMeta)
        ) {
            return currentUserIdFromMeta;
        }

        const profileId = randomUUID();
        const secretKey = randomBytes(32).toString("hex");

        this.databaseService.createProfile(
            profileId,
            defaultProfile,
            secretKey,
        );
        this.metaService.setCurrentUserId(profileId);

        return profileId;
    }
}
