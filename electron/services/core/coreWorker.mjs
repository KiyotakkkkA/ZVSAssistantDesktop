import { createRequire } from "node:module";

/** @typedef {{ type: string; requestId?: string; [key: string]: unknown }} WorkerRequest */

/** @typedef {{ type: string; requestId?: string; ok?: boolean; result?: unknown; error?: string; rawPayload?: string; message?: string }} WorkerResponse */

/** @type {null | {
 *   runChatSessionCore: (payloadJson: string, token: string, baseUrl: string | undefined | null, callback: (err: null | Error, event: string) => void) => Promise<void>;
 *   cancelChatSessionCore: (sessionId: string) => Promise<boolean>;
 *   resolveCommandApprovalCore: (payloadJson: string) => Promise<boolean>;
 *   interruptCommandExecCore: (callId: string) => Promise<boolean>;
 *   submitToolResult: (callId: string, resultJson: string) => Promise<boolean>;
 *   calculateDialogContextUsageCore: (payloadJson: string) => Promise<string>;
 *   getBuiltinToolPackages: () => string;
 * }} */
let addon = null;

const sendMessage = (payload) => {
    if (typeof process.send === "function") {
        process.send(payload);
    }
};

const replyOk = (requestId, result) => {
    sendMessage({
        type: "response",
        requestId,
        ok: true,
        result,
    });
};

const replyError = (requestId, error) => {
    sendMessage({
        type: "response",
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
};

const ensureAddon = () => {
    if (!addon) {
        throw new Error("Core addon is not initialized");
    }

    return addon;
};

const parseSessionId = (payloadJson) => {
    try {
        const payload = JSON.parse(payloadJson);
        if (payload && typeof payload.sessionId === "string") {
            return payload.sessionId.trim();
        }
    } catch {
        return "";
    }

    return "";
};

const handleMessage = async (rawMessage) => {
    const message = /** @type {WorkerRequest} */ (rawMessage);
    const type = message?.type;
    const requestId =
        typeof message?.requestId === "string" ? message.requestId : "";

    if (!type || !requestId) {
        return;
    }

    try {
        if (type === "init") {
            const loaderPath =
                typeof message.addonLoaderPath === "string"
                    ? message.addonLoaderPath
                    : "";

            if (!loaderPath.trim()) {
                throw new Error("loaderPath is required");
            }

            const require = createRequire(import.meta.url);
            addon = require(loaderPath);
            replyOk(requestId, true);
            return;
        }

        if (type === "run_session") {
            const payloadJson =
                typeof message.payloadJson === "string"
                    ? message.payloadJson
                    : "";
            const token =
                typeof message.token === "string" ? message.token : "";
            const baseUrl =
                typeof message.baseUrl === "string" && message.baseUrl.trim()
                    ? message.baseUrl
                    : undefined;
            const sessionId = parseSessionId(payloadJson);

            await ensureAddon().runChatSessionCore(
                payloadJson,
                token,
                baseUrl,
                (error, rawPayload) => {
                    if (error) {
                        sendMessage({
                            type: "chat_event",
                            requestId,
                            error:
                                error.message || "Native chat runtime failed",
                            rawPayload: "",
                            sessionId,
                        });
                        return;
                    }

                    sendMessage({
                        type: "chat_event",
                        requestId,
                        rawPayload,
                        sessionId,
                    });
                },
            );

            replyOk(requestId, true);
            return;
        }

        if (type === "cancel_session") {
            const sessionId =
                typeof message.sessionId === "string" ? message.sessionId : "";
            const result = await ensureAddon().cancelChatSessionCore(sessionId);
            replyOk(requestId, result);
            return;
        }

        if (type === "resolve_command_approval") {
            const payloadJson =
                typeof message.payloadJson === "string"
                    ? message.payloadJson
                    : "";
            const result =
                await ensureAddon().resolveCommandApprovalCore(payloadJson);
            replyOk(requestId, result);
            return;
        }

        if (type === "interrupt_command_exec") {
            const callId =
                typeof message.callId === "string" ? message.callId : "";
            const result = await ensureAddon().interruptCommandExecCore(callId);
            replyOk(requestId, result);
            return;
        }

        if (type === "submit_tool_result") {
            const callId =
                typeof message.callId === "string" ? message.callId : "";
            const resultJson =
                typeof message.resultJson === "string"
                    ? message.resultJson
                    : "{}";
            const result = await ensureAddon().submitToolResult(
                callId,
                resultJson,
            );
            replyOk(requestId, result);
            return;
        }

        if (type === "calculate_dialog_context_usage") {
            const payloadJson =
                typeof message.payloadJson === "string"
                    ? message.payloadJson
                    : "{}";
            const result =
                await ensureAddon().calculateDialogContextUsageCore(
                    payloadJson,
                );
            replyOk(requestId, result);
            return;
        }

        if (type === "get_builtin_tool_packages") {
            const result = ensureAddon().getBuiltinToolPackages();
            replyOk(requestId, result);
            return;
        }

        if (type === "shutdown") {
            replyOk(requestId, true);
            setTimeout(() => {
                process.exit(0);
            }, 10);
            return;
        }

        throw new Error(`Unsupported worker command: ${type}`);
    } catch (error) {
        replyError(requestId, error);
    }
};

process.on("message", (message) => {
    void handleMessage(message);
});

process.on("disconnect", () => {
    process.exit(0);
});
