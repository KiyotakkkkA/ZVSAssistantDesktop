import type {
    ChatSessionEvent,
    ResolveCommandApprovalPayload,
    RunChatSessionPayload,
} from "../../../src/types/ElectronApi";
import { Config } from "../../../src/config";
import { toToolErrorPayload } from "../../../src/utils/chat/toolExecution";
import type { BrowserService } from "../BrowserService";
import type { UserProfileService } from "../userData/UserProfileService";
import type { DatabaseService } from "../storage/DatabaseService";
import { getNativeCoreAddon } from "../core/nativeCoreAddon";

type ChatSessionServiceDeps = {
    browserService: BrowserService;
    userProfileService: UserProfileService;
    databaseService: DatabaseService;
};

type NativeChatCallbackPayload =
    | {
          kind: "chat_event";
          event: ChatSessionEvent;
      }
    | {
          kind: "host_call";
          request_id: string;
          session_id: string;
          method: string;
          args: Record<string, unknown>;
      };

const coreAddon = getNativeCoreAddon();

export class ChatSessionService {
    constructor(private readonly deps: ChatSessionServiceDeps) {}

    async runSession(
        payload: RunChatSessionPayload,
        emit: (event: ChatSessionEvent) => void,
    ): Promise<void> {
        const sessionId = payload.sessionId.trim();

        if (!sessionId) {
            throw new Error("sessionId is required");
        }

        const ollamaToken =
            this.deps.userProfileService.getUserProfile().ollamaToken;

        await coreAddon.runChatSessionCore(
            JSON.stringify(payload),
            ollamaToken,
            Config.OLLAMA_BASE_URL.trim(),
            (error, rawPayload) => {
                if (error) {
                    emit({
                        sessionId,
                        type: "error",
                        message: error.message || "Native chat runtime failed",
                    });
                    return;
                }

                let payloadEnvelope: NativeChatCallbackPayload;

                try {
                    payloadEnvelope = JSON.parse(
                        rawPayload,
                    ) as NativeChatCallbackPayload;
                } catch {
                    emit({
                        sessionId,
                        type: "error",
                        message: "Invalid native chat callback payload",
                    });
                    return;
                }

                if (payloadEnvelope.kind === "chat_event") {
                    emit(payloadEnvelope.event);
                    return;
                }

                void this.handleHostCall(payloadEnvelope).catch((error) => {
                    console.error(
                        "[ChatSessionService] handleHostCall failed:",
                        error,
                    );
                });
            },
        );
    }

    cancelSession(sessionId: string): boolean {
        void coreAddon.cancelChatSessionCore(sessionId);
        return true;
    }

    resolveCommandApproval(payload: ResolveCommandApprovalPayload): boolean {
        void coreAddon.resolveCommandApprovalCore(JSON.stringify(payload));
        return true;
    }

    private async handleHostCall(
        payload: Extract<NativeChatCallbackPayload, { kind: "host_call" }>,
    ): Promise<void> {
        try {
            const result = await this.executeHostMethod(
                payload.method,
                payload.args,
            );
            await coreAddon.submitToolResult(
                payload.request_id,
                JSON.stringify(result),
            );
        } catch (error) {
            await coreAddon.submitToolResult(
                payload.request_id,
                JSON.stringify({
                    __hostError: toToolErrorPayload(payload.method, error),
                }),
            );
        }
    }

    private async executeHostMethod(
        method: string,
        args: Record<string, unknown>,
    ): Promise<unknown> {
        if (method === "browser.open_url") {
            const url = typeof args.url === "string" ? args.url : "";
            const timeoutMs =
                typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

            return this.deps.browserService.openUrl(url, timeoutMs);
        }

        if (method === "browser.get_page_snapshot") {
            const maxElements =
                typeof args.maxElements === "number"
                    ? args.maxElements
                    : undefined;

            return this.deps.browserService.getPageSnapshot(maxElements);
        }

        if (method === "browser.interact") {
            const action =
                typeof args.action === "string"
                    ? (args.action as "click" | "type")
                    : "click";
            const selector =
                typeof args.selector === "string" ? args.selector : "";
            const text = typeof args.text === "string" ? args.text : undefined;
            const submit =
                typeof args.submit === "boolean" ? args.submit : undefined;
            const waitForNavigationMs =
                typeof args.waitForNavigationMs === "number"
                    ? args.waitForNavigationMs
                    : undefined;

            return this.deps.browserService.interactWith({
                action,
                selector,
                text,
                submit,
                waitForNavigationMs,
            });
        }

        if (method === "browser.close") {
            return this.deps.browserService.closeSession();
        }

        if (method === "tools.store_calling_doc") {
            const dialogIdRaw =
                typeof args.dialogId === "string" ? args.dialogId.trim() : "";
            const sessionId =
                typeof args.sessionId === "string" ? args.sessionId : "";
            const dialogId = dialogIdRaw || sessionId;
            const callId = typeof args.callId === "string" ? args.callId : "";
            const toolName =
                typeof args.toolName === "string" ? args.toolName : "";
            const iteration =
                typeof args.iteration === "number" &&
                Number.isFinite(args.iteration)
                    ? Math.max(1, Math.floor(args.iteration))
                    : 1;
            const payload = args.payload ?? {};

            if (!dialogId || !sessionId || !callId || !toolName) {
                throw new Error(
                    "tools.store_calling_doc requires dialogId/sessionId, callId and toolName",
                );
            }

            const createdBy = this.deps.userProfileService.getCurrentUserId();
            const created = this.deps.databaseService.createToolCallingDocument(
                {
                    createdBy,
                    dialogId,
                    sessionId,
                    callId,
                    toolName,
                    iteration,
                    payload,
                },
            );

            return {
                docId: created.docId,
                createdAt: created.createdAt,
            };
        }

        if (method === "tools.get_tools_calling") {
            const docId =
                typeof args.docId === "string" ? args.docId.trim() : "";

            if (!docId) {
                throw new Error("tools.get_tools_calling requires docId");
            }

            const createdBy = this.deps.userProfileService.getCurrentUserId();
            const doc = this.deps.databaseService.getToolCallingDocument(
                docId,
                createdBy,
            );

            if (!doc) {
                return {
                    ok: false,
                    docId,
                    error: "not_found",
                    message: "Документ не найден",
                };
            }

            return {
                ok: true,
                docId: doc.docId,
                dialogId: doc.dialogId,
                callId: doc.callId,
                toolName: doc.toolName,
                iteration: doc.iteration,
                sessionId: doc.sessionId,
                createdAt: doc.createdAt,
                payload: doc.payload,
            };
        }

        throw new Error(`Unsupported native host method: ${method}`);
    }
}
