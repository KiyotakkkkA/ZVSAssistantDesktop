import { makeAutoObservable, toJS } from "mobx";
import type { DialogUiMessage } from "../../electron/models/dialog";
import { globalStorage } from "./globalStorage";
import type { PersistedDialog } from "../types/electron";

export type DialogIdFormat = `dlg-${string}`;
export type ProjectIdFormat = `prj-${string}`;

export type ChatDialog = {
    id: DialogIdFormat;
    name: string;
    messages: DialogUiMessage[];
    isForProject?: boolean;
    tokenUsage?: unknown;
};

export type ChatProject = {
    id: ProjectIdFormat;
    title: string;
    dialogId: DialogIdFormat;
};

class WorkspaceStore {
    dialogs: ChatDialog[] = [];
    projects: ChatProject[] = [];

    activeDialogId: DialogIdFormat | null = null;
    activeProjectId: ProjectIdFormat | null = null;

    constructor() {
        makeAutoObservable(this);
        void this.bootstrap();
    }

    async bootstrap() {
        const persistedDialogs = await window.workspace.getDialogs();
        this.dialogs = persistedDialogs.map((dialog) =>
            this.mapPersistedDialog(dialog),
        );
        this.restoreLastOpened();
    }

    async createDialog(name = "Новый диалог") {
        const dialogId =
            `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as DialogIdFormat;
        const dialog: ChatDialog = {
            id: dialogId,
            name,
            messages: [],
            isForProject: false,
            tokenUsage: null,
        };

        this.dialogs.push(dialog);

        if (window.workspace?.createDialog) {
            await window.workspace.createDialog(dialogId, name, false);
        }

        this.openDialog(dialogId);
        return dialogId;
    }

    get messages(): DialogUiMessage[] {
        const dialog = this.getActiveDialog();

        if (!dialog) {
            return [];
        }

        return dialog.messages;
    }

    set messages(nextMessages: DialogUiMessage[]) {
        const dialog = this.getActiveDialog();

        if (!dialog) {
            return;
        }

        this.setDialogMessages(dialog.id, nextMessages);
    }

    setDialogMessages(
        dialogId: DialogIdFormat,
        nextMessages: DialogUiMessage[],
        persist = true,
    ) {
        const dialog = this.dialogs.find((item) => item.id === dialogId);

        if (!dialog) {
            return;
        }

        dialog.messages = nextMessages;

        if (persist) {
            void this.persistDialogState(dialogId);
        }
    }

    addMessages(dialogId: string, messages: DialogUiMessage[]) {
        const dialog = this.dialogs.find((d) => d.id === dialogId);

        if (dialog) {
            dialog.messages.push(...messages);
        }
    }

    truncateMessagesFromId(dialogId: string, messageId: string) {
        const dialog = this.dialogs.find((d) => d.id === dialogId);

        if (!dialog) {
            return;
        }

        const index = dialog.messages.findIndex(
            (message) => message.id === messageId,
        );

        if (index < 0) {
            return;
        }

        dialog.messages = dialog.messages.slice(0, index);
        void this.persistDialogState(dialog.id);
    }

    openDialog(dialogId: DialogIdFormat) {
        this.activeDialogId = dialogId;
        this.activeProjectId = null;
        globalStorage.lastOpened = `dlg:${dialogId}`;
    }

    async renameDialog(dialogId: DialogIdFormat, name: string) {
        const dialog = this.dialogs.find((item) => item.id === dialogId);

        if (!dialog) {
            return;
        }

        dialog.name = name.trim() || dialog.name;

        if (window.workspace?.renameDialog) {
            await window.workspace.renameDialog(dialogId, dialog.name);
        }
    }

    async deleteDialog(dialogId: DialogIdFormat) {
        this.dialogs = this.dialogs.filter((item) => item.id !== dialogId);
        this.projects = this.projects.filter(
            (project) => project.dialogId !== dialogId,
        );

        if (window.workspace?.deleteDialog) {
            await window.workspace.deleteDialog(dialogId);
        }

        this.ensureActiveSelection();
    }

    async updateDialogState(dialogId: DialogIdFormat, tokenUsage?: unknown) {
        const dialog = this.dialogs.find((item) => item.id === dialogId);

        if (!dialog) {
            return;
        }

        if (tokenUsage !== undefined) {
            dialog.tokenUsage = tokenUsage;
        }

        await this.persistDialogState(dialogId);
    }

    renameProject(projectId: ProjectIdFormat, title: string) {
        const project = this.projects.find((item) => item.id === projectId);

        if (!project) {
            return;
        }

        project.title = title.trim() || project.title;
    }

    openProject(projectId: ProjectIdFormat) {
        const project = this.projects.find((item) => item.id === projectId);

        if (!project) {
            return;
        }

        this.activeProjectId = project.id;
        this.activeDialogId = project.dialogId;
        globalStorage.lastOpened = `prj:${project.id}/dlg:${project.dialogId}`;
    }

    deleteProject(projectId: ProjectIdFormat) {
        const project = this.projects.find((item) => item.id === projectId);

        if (!project) {
            return;
        }

        this.projects = this.projects.filter((item) => item.id !== projectId);
        this.dialogs = this.dialogs.filter(
            (dialog) => dialog.id !== project.dialogId,
        );

        this.ensureActiveSelection();
    }

    private getActiveDialog() {
        if (!this.activeDialogId) {
            return null;
        }

        return (
            this.dialogs.find((dialog) => dialog.id === this.activeDialogId) ??
            null
        );
    }

    private restoreLastOpened() {
        const lastOpened = globalStorage.lastOpened;

        if (lastOpened?.startsWith("prj:")) {
            const [projectPart, dialogPart] = lastOpened.split("/");
            const projectId = projectPart?.slice(4) as ProjectIdFormat;
            const dialogId = dialogPart?.slice(4) as DialogIdFormat;

            if (
                projectId &&
                dialogId &&
                this.projects.some((project) => project.id === projectId) &&
                this.dialogs.some((dialog) => dialog.id === dialogId)
            ) {
                this.activeProjectId = projectId;
                this.activeDialogId = dialogId;
                return;
            }
        }

        if (lastOpened?.startsWith("dlg:")) {
            const dialogId = lastOpened.slice(4) as DialogIdFormat;

            if (this.dialogs.some((dialog) => dialog.id === dialogId)) {
                this.activeDialogId = dialogId;
                this.activeProjectId = null;
                return;
            }
        }

        const fallbackDialog =
            this.dialogs.find((dialog) => !dialog.isForProject) ??
            this.dialogs[0];

        if (fallbackDialog) {
            this.openDialog(fallbackDialog.id);
            return;
        }

        this.activeDialogId = null;
        this.activeProjectId = null;
    }

    private ensureActiveSelection() {
        if (
            this.activeDialogId &&
            this.dialogs.some((dialog) => dialog.id === this.activeDialogId)
        ) {
            if (
                this.activeProjectId &&
                this.projects.some(
                    (project) => project.id === this.activeProjectId,
                )
            ) {
                return;
            }

            this.activeProjectId = null;
            globalStorage.lastOpened = `dlg:${this.activeDialogId}`;
            return;
        }

        const fallbackDialog =
            this.dialogs.find((dialog) => !dialog.isForProject) ??
            this.dialogs[0] ??
            null;

        if (fallbackDialog) {
            this.openDialog(fallbackDialog.id);
            return;
        }

        this.activeDialogId = null;
        this.activeProjectId = null;
        globalStorage.lastOpened = null;
    }

    private mapPersistedDialog(dialog: PersistedDialog): ChatDialog {
        return {
            id: dialog.id,
            name: dialog.name,
            isForProject: dialog.is_for_project,
            messages: dialog.ui_messages,
            tokenUsage: dialog.token_usage,
        };
    }

    private buildContextMessages(messages: DialogUiMessage[]) {
        return messages
            .filter(
                (message) =>
                    message.role === "user" || message.role === "assistant",
            )
            .filter(
                (message) =>
                    message.status !== "streaming" &&
                    (message.role === "user" ||
                        message.content.trim().length > 0),
            )
            .map((message) => ({
                role: message.role,
                content: message.content,
            }));
    }

    private async persistDialogState(dialogId: DialogIdFormat) {
        const dialog = this.dialogs.find((item) => item.id === dialogId);

        if (!dialog) {
            return;
        }

        await window.workspace.updateDialogMessages(
            dialogId,
            toJS(dialog.messages),
            this.buildContextMessages(toJS(dialog.messages)),
            dialog.tokenUsage ? toJS(dialog.tokenUsage) : null,
        );
    }
}

export const workspaceStore = new WorkspaceStore();
