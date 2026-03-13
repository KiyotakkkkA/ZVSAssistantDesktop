import { makeAutoObservable, runInAction } from "mobx";
import type {
    ChatDialog,
    ChatDialogListItem,
    ChatMessage,
} from "../types/Chat";

const toCloneSafeValue = (
    value: unknown,
    seen: WeakSet<object> = new WeakSet<object>(),
): unknown => {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    if (typeof value === "bigint") {
        return value.toString();
    }

    if (
        value === undefined ||
        typeof value === "function" ||
        typeof value === "symbol"
    ) {
        return null;
    }

    if (Array.isArray(value)) {
        return value.map((item) => toCloneSafeValue(item, seen));
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "object") {
        if (seen.has(value)) {
            return "[Circular]";
        }

        seen.add(value);
        const entries = Object.entries(value as Record<string, unknown>).map(
            ([key, entry]) => [key, toCloneSafeValue(entry, seen)],
        );
        return Object.fromEntries(entries);
    }

    return String(value);
};

const toCloneSafeRecord = (value: unknown): Record<string, unknown> => {
    const safe = toCloneSafeValue(value);

    if (safe && typeof safe === "object" && !Array.isArray(safe)) {
        return safe as Record<string, unknown>;
    }

    return {};
};

class ChatsStore {
    isReady = false;
    isSwitchingDialog = false;
    dialogs: ChatDialogListItem[] = [];
    activeDialog: ChatDialog | null = null;
    messages: ChatMessage[] = [];

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
                    const now = new Date().toISOString();
                    this.activeDialog = {
                        id: `dialog_${crypto.randomUUID().replace(/-/g, "")}`,
                        title: "Новый диалог",
                        messages: [],
                        forProjectId: null,
                        createdAt: now,
                        updatedAt: now,
                    };
                    this.messages = [];
                    this.dialogs = [];
                    this.isReady = true;
                });
                return;
            }

            const [dialogs, activeDialog] = await Promise.all([
                api.dialogs.getDialogsList(),
                api.dialogs.getActiveDialog(),
            ]);

            runInAction(() => {
                this.dialogs = dialogs;
                this.activeDialog = activeDialog;
                this.messages = activeDialog.messages;
                this.isReady = true;
            });
        } finally {
            runInAction(() => {
                this.isInitializing = false;
            });
        }
    }

    setMessages(nextMessages: ChatMessage[]): void {
        this.messages = nextMessages;

        if (this.activeDialog) {
            this.activeDialog = {
                ...this.activeDialog,
                messages: nextMessages,
            };
        }
    }

    replaceByDialog(dialog: ChatDialog): void {
        this.activeDialog = dialog;
        this.messages = dialog.messages;
        this.upsertDialogListItem(dialog);
    }

    async switchDialog(dialogId: string): Promise<void> {
        const api = window.appApi;

        if (!api) {
            return;
        }

        runInAction(() => {
            this.isSwitchingDialog = true;
        });

        try {
            const dialog = await api.dialogs.getDialogById(dialogId);

            runInAction(() => {
                this.replaceByDialog(dialog);
            });
        } finally {
            runInAction(() => {
                this.isSwitchingDialog = false;
            });
        }
    }

    async createDialog(): Promise<ChatDialog | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const dialog = await api.dialogs.createDialog();

        runInAction(() => {
            this.replaceByDialog(dialog);
        });

        return dialog;
    }

    async renameDialog(
        dialogId: string,
        title: string,
    ): Promise<ChatDialog | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const dialog = await api.dialogs.renameDialog(dialogId, title);

        runInAction(() => {
            if (this.activeDialog?.id === dialog.id) {
                this.activeDialog = dialog;
                this.messages = dialog.messages;
            }
            this.upsertDialogListItem(dialog);
        });

        return dialog;
    }

    async deleteDialog(dialogId: string): Promise<void> {
        const api = window.appApi;

        if (!api) {
            return;
        }

        const result = await api.dialogs.deleteDialog(dialogId);

        runInAction(() => {
            this.dialogs = result.dialogs;
            this.activeDialog = result.activeDialog;
            this.messages = result.activeDialog.messages;
        });
    }

    async saveSnapshot(dialog: ChatDialog): Promise<ChatDialog> {
        const api = window.appApi;
        const serializableDialog = this.toSerializableDialog(dialog);

        if (!api) {
            runInAction(() => {
                this.replaceByDialog(serializableDialog);
            });
            return serializableDialog;
        }

        const savedDialog =
            await api.dialogs.saveDialogSnapshot(serializableDialog);

        runInAction(() => {
            this.replaceByDialog(savedDialog);
        });

        return savedDialog;
    }

    private toSerializableDialog(dialog: ChatDialog): ChatDialog {
        return {
            id: String(dialog.id),
            title: String(dialog.title),
            forProjectId:
                typeof dialog.forProjectId === "string"
                    ? dialog.forProjectId
                    : null,
            createdAt: String(dialog.createdAt),
            updatedAt: String(dialog.updatedAt),
            ...(dialog.tokenUsage
                ? {
                      tokenUsage: {
                          promptTokens: Math.max(
                              0,
                              Math.floor(dialog.tokenUsage.promptTokens || 0),
                          ),
                          completionTokens: Math.max(
                              0,
                              Math.floor(
                                  dialog.tokenUsage.completionTokens || 0,
                              ),
                          ),
                          totalTokens: Math.max(
                              0,
                              Math.floor(dialog.tokenUsage.totalTokens || 0),
                          ),
                      },
                  }
                : {}),
            messages: dialog.messages.map((message) => ({
                id: String(message.id),
                author: message.author,
                content: String(message.content),
                timestamp: String(message.timestamp),
                ...(typeof message.answeringAt === "string"
                    ? { answeringAt: message.answeringAt }
                    : {}),
                ...(message.assistantStage
                    ? { assistantStage: message.assistantStage }
                    : {}),
                ...(message.toolTrace
                    ? {
                          toolTrace: {
                              callId: String(message.toolTrace.callId),
                              toolName: String(message.toolTrace.toolName),
                              args: toCloneSafeRecord(message.toolTrace.args),
                              result: toCloneSafeValue(
                                  message.toolTrace.result,
                              ),
                              ...(message.toolTrace.status
                                  ? { status: message.toolTrace.status }
                                  : {}),
                              ...(typeof message.toolTrace.command === "string"
                                  ? { command: message.toolTrace.command }
                                  : {}),
                              ...(typeof message.toolTrace.cwd === "string"
                                  ? { cwd: message.toolTrace.cwd }
                                  : {}),
                              ...(typeof message.toolTrace.isAdmin === "boolean"
                                  ? { isAdmin: message.toolTrace.isAdmin }
                                  : {}),
                              ...(typeof message.toolTrace.confirmationTitle ===
                              "string"
                                  ? {
                                        confirmationTitle:
                                            message.toolTrace.confirmationTitle,
                                    }
                                  : {}),
                              ...(typeof message.toolTrace
                                  .confirmationPrompt === "string"
                                  ? {
                                        confirmationPrompt:
                                            message.toolTrace
                                                .confirmationPrompt,
                                    }
                                  : {}),
                          },
                      }
                    : {}),
                ...(typeof message.hidden === "boolean"
                    ? { hidden: message.hidden }
                    : {}),
            })),
        };
    }

    private upsertDialogListItem(dialog: ChatDialog): void {
        if (dialog.forProjectId) {
            this.dialogs = this.dialogs.filter(
                (existing) => existing.id !== dialog.id,
            );
            return;
        }

        const lastMessage =
            dialog.messages.length > 0
                ? dialog.messages[dialog.messages.length - 1]
                : null;

        const preview =
            lastMessage?.content?.trim() ||
            "Пустой диалог — отправьте первое сообщение";

        const item: ChatDialogListItem = {
            id: dialog.id,
            title: dialog.title,
            preview,
            time: new Date(dialog.updatedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            updatedAt: dialog.updatedAt,
            ...(dialog.tokenUsage ? { tokenUsage: dialog.tokenUsage } : {}),
        };

        const next = [
            item,
            ...this.dialogs.filter((existing) => existing.id !== dialog.id),
        ];

        next.sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
        );
        this.dialogs = next;
    }
}

export const chatsStore = new ChatsStore();
