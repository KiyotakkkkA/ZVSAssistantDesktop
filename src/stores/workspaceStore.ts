import { makeAutoObservable } from "mobx";
import { globalStorage } from "./globalStorage";

export type DialogIdFormat = `dlg-${string}`;
export type ProjectIdFormat = `prj-${string}`;

export type ChatMessage = {
    id: `msg-${string}`;
    role: "user" | "assistant";
    answeringAt?: string;
    content: string;
    reasoning?: string;
    timestamp: string;
    status: "streaming" | "done" | "error";
};

export type ChatDialog = {
    id: DialogIdFormat;
    title: string;
    messages: ChatMessage[];
    isForProject?: boolean;
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
        this.restoreLastOpened();
    }

    createDialog(title = "Новый диалог") {
        const dialogId =
            `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as DialogIdFormat;

        this.dialogs.push({
            id: dialogId,
            title,
            messages: [],
        });

        this.openDialog(dialogId);
        return dialogId;
    }

    get messages(): ChatMessage[] {
        const dialog = this.getActiveDialog();

        if (!dialog) {
            return [];
        }

        return dialog.messages;
    }

    set messages(nextMessages: ChatMessage[]) {
        const dialog = this.getActiveDialog();

        if (!dialog) {
            return;
        }

        dialog.messages = nextMessages;
    }

    addMessages(dialogId: string, messages: ChatMessage[]) {
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
    }

    openDialog(dialogId: DialogIdFormat) {
        this.activeDialogId = dialogId;
        this.activeProjectId = null;
        globalStorage.lastOpened = `dlg:${dialogId}`;
    }

    renameDialog(dialogId: DialogIdFormat, title: string) {
        const dialog = this.dialogs.find((item) => item.id === dialogId);

        if (!dialog) {
            return;
        }

        dialog.title = title.trim() || dialog.title;
    }

    deleteDialog(dialogId: DialogIdFormat) {
        this.dialogs = this.dialogs.filter((item) => item.id !== dialogId);
        this.projects = this.projects.filter(
            (project) => project.dialogId !== dialogId,
        );

        this.ensureActiveSelection();
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
}

export const workspaceStore = new WorkspaceStore();
