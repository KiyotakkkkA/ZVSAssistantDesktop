import { randomUUID } from "node:crypto";
import { createBaseDialog } from "../../static/data";
import { DatabaseService } from "../storage/DatabaseService";
import type {
    ChatDialog,
    ChatDialogListItem,
    ChatMessage,
    DeleteDialogResult,
    TokenUsage,
} from "../../../src/types/Chat";
import type { ActiveDialogContextUpdater } from "../../../src/types/UserData";

const ASSISTANT_MESSAGE_AUTHORS = new Set(["assistant", "user", "system"]);
const ASSISTANT_STAGES = new Set([
    "thinking",
    "planning",
    "questioning",
    "tools_calling",
    "answering",
]);
const TOOL_STAGES = new Set(["planning", "questioning", "tools_calling"]);

export class DialogsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly onActiveDialogContextUpdate: ActiveDialogContextUpdater,
        private readonly createdBy: string,
    ) {}

    getActiveDialog(activeDialogId?: string): ChatDialog {
        const dialogs = this.readDialogs();

        if (activeDialogId) {
            const activeDialog = dialogs.find(
                (dialog) => dialog.id === activeDialogId,
            );

            if (activeDialog) {
                return activeDialog;
            }
        }

        const availableDialogs = dialogs.filter(
            (dialog) => dialog.forProjectId === null,
        );

        if (availableDialogs.length > 0) {
            const fallbackActiveDialog = availableDialogs[0];
            this.onActiveDialogContextUpdate({
                activeDialogId: fallbackActiveDialog.id,
                activeProjectId: fallbackActiveDialog.forProjectId,
            });
            return fallbackActiveDialog;
        }

        const baseDialog = createBaseDialog();
        this.writeDialog(baseDialog);
        this.onActiveDialogContextUpdate({
            activeDialogId: baseDialog.id,
            activeProjectId: baseDialog.forProjectId,
        });
        return baseDialog;
    }

    getDialogsList(): ChatDialogListItem[] {
        const standaloneDialogs = this.readDialogs().filter(
            (dialog) => dialog.forProjectId === null,
        );

        if (standaloneDialogs.length === 0) {
            const baseDialog = createBaseDialog();
            this.writeDialog(baseDialog);
            this.onActiveDialogContextUpdate({
                activeDialogId: baseDialog.id,
                activeProjectId: baseDialog.forProjectId,
            });

            return [this.toDialogListItem(baseDialog)];
        }

        return standaloneDialogs.map((dialog) => this.toDialogListItem(dialog));
    }

    getDialogById(dialogId: string, activeDialogId?: string): ChatDialog {
        const dialogs = this.readDialogs();
        const dialog = dialogs.find((item) => item.id === dialogId);

        if (dialog) {
            this.onActiveDialogContextUpdate({
                activeDialogId: dialog.id,
                activeProjectId: dialog.forProjectId,
            });
            return dialog;
        }

        return this.getActiveDialog(activeDialogId);
    }

    createDialog(forProjectId: string | null = null): ChatDialog {
        const baseDialog = createBaseDialog(forProjectId);
        this.writeDialog(baseDialog);
        this.onActiveDialogContextUpdate({
            activeDialogId: baseDialog.id,
            activeProjectId: baseDialog.forProjectId,
        });
        return baseDialog;
    }

    linkDialogToProject(dialogId: string, projectId: string): void {
        const dialogs = this.readDialogs();
        const targetDialog = dialogs.find((dialog) => dialog.id === dialogId);

        if (!targetDialog || targetDialog.forProjectId === projectId) {
            return;
        }

        this.writeDialog({
            ...targetDialog,
            forProjectId: projectId,
            updatedAt: new Date().toISOString(),
        });
    }

    renameDialog(
        dialogId: string,
        nextTitle: string,
        activeDialogId?: string,
    ): ChatDialog {
        const dialog = this.getDialogById(dialogId, activeDialogId);
        const trimmedTitle = nextTitle.trim();

        const updatedDialog: ChatDialog = {
            ...dialog,
            title: trimmedTitle || dialog.title,
            updatedAt: new Date().toISOString(),
        };

        this.writeDialog(updatedDialog);
        return updatedDialog;
    }

    deleteDialog(dialogId: string): DeleteDialogResult {
        this.databaseService.deleteDialog(dialogId, this.createdBy);

        let dialogs = this.readDialogs();

        if (dialogs.length === 0) {
            const fallbackDialog = createBaseDialog();
            this.writeDialog(fallbackDialog);
            dialogs = [fallbackDialog];
        }

        const fallbackDialog =
            dialogs.find((dialog) => dialog.forProjectId === null) ||
            dialogs[0];

        this.onActiveDialogContextUpdate({
            activeDialogId: fallbackDialog.id,
            activeProjectId: fallbackDialog.forProjectId,
        });

        return {
            dialogs: dialogs
                .filter((dialog) => dialog.forProjectId === null)
                .map((dialog) => this.toDialogListItem(dialog)),
            activeDialog: fallbackDialog,
        };
    }

    deleteMessageFromDialog(
        dialogId: string,
        messageId: string,
        activeDialogId?: string,
    ): ChatDialog {
        const dialog = this.getDialogById(dialogId, activeDialogId);

        const targetIndex = dialog.messages.findIndex(
            (message) => message.id === messageId,
        );
        const targetMessage = dialog.messages.find(
            (message) => message.id === messageId,
        );

        if (!targetMessage || targetIndex === -1) {
            return dialog;
        }

        const deletedIds = new Set<string>([messageId]);
        const previousMessage = dialog.messages[targetIndex - 1];

        if (
            targetMessage.author === "user" &&
            this.isScenarioLaunchMessage(previousMessage)
        ) {
            deletedIds.add(previousMessage.id);
        }

        const nextMessages = dialog.messages.filter(
            (message) =>
                !deletedIds.has(message.id) &&
                !(
                    typeof message.answeringAt === "string" &&
                    deletedIds.has(message.answeringAt)
                ),
        );

        const updatedDialog: ChatDialog = {
            ...dialog,
            messages: nextMessages,
            updatedAt: new Date().toISOString(),
        };

        this.writeDialog(updatedDialog);
        return updatedDialog;
    }

    truncateDialogFromMessage(
        dialogId: string,
        messageId: string,
        activeDialogId?: string,
    ): ChatDialog {
        const dialog = this.getDialogById(dialogId, activeDialogId);
        const messageIndex = dialog.messages.findIndex(
            (message) => message.id === messageId,
        );

        if (messageIndex === -1) {
            return dialog;
        }

        const targetMessage = dialog.messages[messageIndex];
        const previousMessage = dialog.messages[messageIndex - 1];
        const truncateIndex =
            targetMessage?.author === "user" &&
            this.isScenarioLaunchMessage(previousMessage)
                ? messageIndex - 1
                : messageIndex;

        const updatedDialog: ChatDialog = {
            ...dialog,
            messages: dialog.messages.slice(0, truncateIndex),
            updatedAt: new Date().toISOString(),
        };

        this.writeDialog(updatedDialog);
        return updatedDialog;
    }

    saveDialogSnapshot(dialog: ChatDialog): ChatDialog {
        const normalizedMessages = dialog.messages.map((message) =>
            this.normalizeMessage(message),
        );

        const normalizedDialog: ChatDialog = {
            id: this.normalizeDialogId(dialog.id),
            title:
                typeof dialog.title === "string" && dialog.title.trim()
                    ? dialog.title
                    : "Новый диалог",
            messages: normalizedMessages,
            tokenUsage: this.normalizeTokenUsage(dialog.tokenUsage),
            forProjectId: this.normalizeForProjectId(dialog.forProjectId),
            createdAt:
                typeof dialog.createdAt === "string" && dialog.createdAt
                    ? dialog.createdAt
                    : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.writeDialog(normalizedDialog);
        this.onActiveDialogContextUpdate({
            activeDialogId: normalizedDialog.id,
            activeProjectId: normalizedDialog.forProjectId,
        });
        return normalizedDialog;
    }

    private readDialogs(): ChatDialog[] {
        const dialogs: ChatDialog[] = [];

        for (const rawItem of this.databaseService.getDialogsRaw(
            this.createdBy,
        )) {
            const parsed = rawItem as Partial<ChatDialog>;

            if (!Array.isArray(parsed.messages)) {
                continue;
            }

            const normalizedMessages = parsed.messages
                .map((message) => this.normalizeMessage(message as ChatMessage))
                .filter(Boolean);

            dialogs.push({
                id: this.normalizeDialogId(parsed.id),
                title:
                    typeof parsed.title === "string" && parsed.title.trim()
                        ? parsed.title
                        : "Новый диалог",
                messages: normalizedMessages,
                tokenUsage: this.normalizeTokenUsage(parsed.tokenUsage),
                forProjectId: this.normalizeForProjectId(parsed.forProjectId),
                createdAt:
                    typeof parsed.createdAt === "string" && parsed.createdAt
                        ? parsed.createdAt
                        : new Date().toISOString(),
                updatedAt:
                    typeof parsed.updatedAt === "string" && parsed.updatedAt
                        ? parsed.updatedAt
                        : new Date().toISOString(),
            });
        }

        dialogs.sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
        );

        return dialogs;
    }

    private writeDialog(dialog: ChatDialog): void {
        this.databaseService.upsertDialogRaw(dialog.id, dialog, this.createdBy);
    }

    private normalizeDialogId(id: unknown): string {
        if (typeof id === "string" && id.startsWith("dialog_")) {
            return id;
        }

        return `dialog_${randomUUID().replace(/-/g, "")}`;
    }

    private normalizeForProjectId(forProjectId: unknown): string | null {
        if (
            typeof forProjectId === "string" &&
            forProjectId.startsWith("project_")
        ) {
            return forProjectId;
        }

        return null;
    }

    private normalizeMessage(message: ChatMessage): ChatMessage {
        const rawAuthor = (message as { author?: string }).author;

        const role = ASSISTANT_MESSAGE_AUTHORS.has(rawAuthor || "")
            ? (rawAuthor as "assistant" | "user" | "system")
            : "assistant";

        const rawAssistantStage = (message as { assistantStage?: string })
            .assistantStage;

        const assistantStage =
            role === "assistant"
                ? ASSISTANT_STAGES.has(rawAssistantStage || "")
                    ? (rawAssistantStage as
                          | "thinking"
                          | "planning"
                          | "questioning"
                          | "tools_calling"
                          | "answering")
                    : "answering"
                : undefined;

        const isToolLikeStage = TOOL_STAGES.has(assistantStage || "");

        const toolTrace =
            role === "assistant" && isToolLikeStage
                ? message.toolTrace &&
                  typeof message.toolTrace.callId === "string" &&
                  typeof message.toolTrace.toolName === "string" &&
                  typeof message.toolTrace.args === "object" &&
                  message.toolTrace.args !== null
                    ? message.toolTrace
                    : undefined
                : undefined;

        return {
            id:
                typeof message.id === "string" && message.id.startsWith("msg_")
                    ? message.id
                    : `msg_${randomUUID().replace(/-/g, "")}`,
            author: role,
            content: typeof message.content === "string" ? message.content : "",
            timestamp:
                typeof message.timestamp === "string" && message.timestamp
                    ? message.timestamp
                    : new Date().toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                      }),
            ...(typeof message.answeringAt === "string"
                ? { answeringAt: message.answeringAt }
                : {}),
            ...(assistantStage ? { assistantStage } : {}),
            ...(toolTrace ? { toolTrace } : {}),
            ...(typeof message.hidden === "boolean"
                ? { hidden: message.hidden }
                : {}),
        };
    }

    private normalizeTokenUsage(value: unknown): TokenUsage {
        const raw =
            value && typeof value === "object"
                ? (value as Partial<TokenUsage>)
                : {};

        const promptTokens =
            typeof raw.promptTokens === "number" &&
            Number.isFinite(raw.promptTokens)
                ? Math.max(0, Math.floor(raw.promptTokens))
                : 0;
        const completionTokens =
            typeof raw.completionTokens === "number" &&
            Number.isFinite(raw.completionTokens)
                ? Math.max(0, Math.floor(raw.completionTokens))
                : 0;
        const totalTokens =
            typeof raw.totalTokens === "number" &&
            Number.isFinite(raw.totalTokens)
                ? Math.max(0, Math.floor(raw.totalTokens))
                : promptTokens + completionTokens;

        return {
            promptTokens,
            completionTokens,
            totalTokens,
        };
    }

    private isScenarioLaunchMessage(message: ChatMessage | undefined): boolean {
        return (
            message?.author === "system" &&
            typeof message.content === "string" &&
            message.content.startsWith("SCENARIO_LAUNCH:")
        );
    }

    private toDialogListItem(dialog: ChatDialog): ChatDialogListItem {
        const lastMessage =
            dialog.messages.length > 0
                ? dialog.messages[dialog.messages.length - 1]
                : null;

        return {
            id: dialog.id,
            title: dialog.title,
            preview:
                lastMessage?.content?.trim() ||
                "Пустой диалог — отправьте первое сообщение",
            time: new Date(dialog.updatedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            updatedAt: dialog.updatedAt,
            tokenUsage: this.normalizeTokenUsage(dialog.tokenUsage),
        };
    }
}
