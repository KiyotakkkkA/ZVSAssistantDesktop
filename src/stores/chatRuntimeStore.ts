import { makeAutoObservable, runInAction } from "mobx";

class ChatRuntimeStore {
    activeSessionId: string | null = null;
    isStreaming = false;
    isAwaitingFirstChunk = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    get isChatBusy(): boolean {
        return (
            this.activeSessionId !== null &&
            (this.isStreaming || this.isAwaitingFirstChunk)
        );
    }

    startSession(sessionId: string): void {
        this.activeSessionId = sessionId;
        this.isStreaming = true;
        this.isAwaitingFirstChunk = true;
    }

    updateStreamingState(payload: {
        isStreaming?: boolean;
        isAwaitingFirstChunk?: boolean;
    }): void {
        runInAction(() => {
            if (typeof payload.isStreaming === "boolean") {
                this.isStreaming = payload.isStreaming;
            }

            if (typeof payload.isAwaitingFirstChunk === "boolean") {
                this.isAwaitingFirstChunk = payload.isAwaitingFirstChunk;
            }
        });
    }

    clearSession(): void {
        this.activeSessionId = null;
        this.isStreaming = false;
        this.isAwaitingFirstChunk = false;
    }

    async interruptActiveSession(): Promise<boolean> {
        const sessionId = this.activeSessionId?.trim();

        if (!sessionId) {
            return false;
        }

        return (
            (await window.appApi?.llm?.cancelChatSession(sessionId)) ?? false
        );
    }
}

export const chatRuntimeStore = new ChatRuntimeStore();
