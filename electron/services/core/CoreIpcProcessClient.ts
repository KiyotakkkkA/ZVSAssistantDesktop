import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";

type CoreWorkerResponse = {
    type: "response";
    requestId: string;
    ok: boolean;
    result?: unknown;
    error?: string;
};

type CoreWorkerChatEvent = {
    type: "chat_event";
    requestId: string;
    rawPayload: string;
    error?: string;
};

type CoreWorkerMessage = CoreWorkerResponse | CoreWorkerChatEvent;

type NativeChatPayloadEnvelope = {
    kind?: string;
    event?: {
        type?: string;
    };
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
};

type CoreIpcProcessClientOptions = {
    workerScriptPath: string;
    addonLoaderPath: string;
};

export class CoreIpcProcessClient {
    private child: ChildProcess | null = null;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly chatEventHandlers = new Map<
        string,
        (error: null | Error, rawPayload: string) => void
    >();
    private startPromise: Promise<void> | null = null;
    private shutdownPromise: Promise<void> | null = null;

    constructor(private readonly options: CoreIpcProcessClientOptions) {}

    async start(): Promise<void> {
        if (this.child?.connected) {
            return;
        }

        if (!this.startPromise) {
            this.startPromise = this.startInternal().finally(() => {
                this.startPromise = null;
            });
        }

        await this.startPromise;
    }

    async shutdown(): Promise<void> {
        if (!this.child) {
            return;
        }

        if (!this.shutdownPromise) {
            this.shutdownPromise = this.shutdownInternal().finally(() => {
                this.shutdownPromise = null;
            });
        }

        await this.shutdownPromise;
    }

    async runChatSession(
        payloadJson: string,
        token: string,
        baseUrl: string | undefined | null,
        onEvent: (error: null | Error, rawPayload: string) => void,
    ): Promise<void> {
        await this.start();

        const requestId = randomUUID();
        this.chatEventHandlers.set(requestId, onEvent);

        try {
            await this.sendRequest<void>("run_session", {
                requestId,
                payloadJson,
                token,
                baseUrl,
            });
        } catch (error) {
            this.chatEventHandlers.delete(requestId);
            throw error;
        }
    }

    async cancelChatSession(sessionId: string): Promise<boolean> {
        await this.start();
        return this.sendRequest<boolean>("cancel_session", { sessionId });
    }

    async resolveCommandApproval(payloadJson: string): Promise<boolean> {
        await this.start();
        return this.sendRequest<boolean>("resolve_command_approval", {
            payloadJson,
        });
    }

    async interruptCommandExec(callId: string): Promise<boolean> {
        await this.start();
        return this.sendRequest<boolean>("interrupt_command_exec", { callId });
    }

    async submitToolResult(
        callId: string,
        resultJson: string,
    ): Promise<boolean> {
        await this.start();
        return this.sendRequest<boolean>("submit_tool_result", {
            callId,
            resultJson,
        });
    }

    async calculateDialogContextUsage(payloadJson: string): Promise<string> {
        await this.start();
        return this.sendRequest<string>("calculate_dialog_context_usage", {
            payloadJson,
        });
    }

    async getBuiltinToolPackages(): Promise<string> {
        await this.start();
        return this.sendRequest<string>("get_builtin_tool_packages", {});
    }

    private async startInternal(): Promise<void> {
        const child = fork(this.options.workerScriptPath, {
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });

        child.stdout?.on("data", (chunk: Buffer) => {
            const line = chunk.toString().trim();
            if (line) {
                console.log(`[core-worker] ${line}`);
            }
        });

        child.stderr?.on("data", (chunk: Buffer) => {
            const line = chunk.toString().trim();
            if (line) {
                console.error(`[core-worker] ${line}`);
            }
        });

        child.on("message", (message) => {
            this.handleWorkerMessage(message);
        });

        child.on("error", (error) => {
            this.rejectAllPending(
                new Error(`Core worker process error: ${error.message}`),
            );
        });

        child.on("exit", (code, signal) => {
            this.child = null;
            this.chatEventHandlers.clear();

            const reason =
                code === 0
                    ? "Core worker process exited"
                    : `Core worker process exited with code ${code} signal ${signal ?? "none"}`;

            this.rejectAllPending(new Error(reason));
        });

        this.child = child;

        await this.sendRequest<void>("init", {
            addonLoaderPath: this.options.addonLoaderPath,
        });
    }

    private async shutdownInternal(): Promise<void> {
        if (!this.child) {
            return;
        }

        const child = this.child;

        try {
            await this.sendRequest<void>("shutdown", {});
        } catch {
            // Ignore transport errors on shutdown path.
        }

        if (!child.killed) {
            child.kill();
        }

        this.child = null;
        this.chatEventHandlers.clear();
        this.rejectAllPending(new Error("Core worker process was shutdown"));
    }

    private sendRequest<T>(
        type: string,
        payload: Record<string, unknown>,
    ): Promise<T> {
        if (!this.child?.connected) {
            return Promise.reject(
                new Error("Core worker process is not connected"),
            );
        }

        const requestId =
            typeof payload.requestId === "string" && payload.requestId.trim()
                ? payload.requestId
                : randomUUID();

        return new Promise<T>((resolve, reject) => {
            this.pendingRequests.set(requestId, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });

            this.child?.send(
                {
                    type,
                    requestId,
                    ...payload,
                },
                (error) => {
                    if (!error) {
                        return;
                    }

                    this.pendingRequests.delete(requestId);
                    reject(error);
                },
            );
        });
    }

    private handleWorkerMessage(rawMessage: unknown): void {
        if (!rawMessage || typeof rawMessage !== "object") {
            return;
        }

        const message = rawMessage as Partial<CoreWorkerMessage>;

        if (
            message.type === "chat_event" &&
            typeof message.requestId === "string"
        ) {
            const handler = this.chatEventHandlers.get(message.requestId);

            if (!handler) {
                return;
            }

            const rawPayload =
                typeof message.rawPayload === "string"
                    ? message.rawPayload
                    : "";
            const error =
                typeof message.error === "string" && message.error
                    ? new Error(message.error)
                    : null;

            handler(error, rawPayload);

            if (error || this.isTerminalChatEventPayload(rawPayload)) {
                this.chatEventHandlers.delete(message.requestId);
            }

            return;
        }

        if (
            message.type !== "response" ||
            typeof message.requestId !== "string"
        ) {
            return;
        }

        const pendingRequest = this.pendingRequests.get(message.requestId);
        if (!pendingRequest) {
            return;
        }

        this.pendingRequests.delete(message.requestId);

        if (message.ok) {
            pendingRequest.resolve(message.result);
            return;
        }

        pendingRequest.reject(
            new Error(
                typeof message.error === "string" && message.error
                    ? message.error
                    : "Core worker request failed",
            ),
        );
    }

    private rejectAllPending(error: Error): void {
        for (const [, request] of this.pendingRequests) {
            request.reject(error);
        }

        this.pendingRequests.clear();
    }

    private isTerminalChatEventPayload(rawPayload: string): boolean {
        if (!rawPayload.trim()) {
            return false;
        }

        try {
            const envelope = JSON.parse(
                rawPayload,
            ) as NativeChatPayloadEnvelope;

            return (
                envelope.kind === "chat_event" &&
                (envelope.event?.type === "done" ||
                    envelope.event?.type === "error")
            );
        } catch {
            return false;
        }
    }
}
