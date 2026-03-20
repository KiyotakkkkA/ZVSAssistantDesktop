import { makeAutoObservable } from "mobx";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    answeringAt?: string;
    content: string;
    reasoning?: string;
    timestamp: string;
    status: "streaming" | "done" | "error";
};

class WorkspaceStore {
    messages: ChatMessage[] = [];

    constructor() {
        makeAutoObservable(this);
    }

    addMessages(messages: ChatMessage[]) {
        this.messages.push(...messages);
    }

    truncateFrom(messageId: string) {
        const index = this.messages.findIndex(
            (message) => message.id === messageId,
        );

        if (index < 0) {
            return;
        }

        this.messages = this.messages.slice(0, index);
    }
}

export const workspaceStore = new WorkspaceStore();
