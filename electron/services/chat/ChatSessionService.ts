import { randomUUID } from "node:crypto";
import type {
    ChatSessionEvent,
    ResolveCommandApprovalPayload,
    RunChatSessionPayload,
} from "../../../src/types/ElectronApi";
import { Config } from "../../../src/config";
import { toToolErrorPayload } from "../../../src/utils/chat/toolExecution";
import type { BrowserService } from "../BrowserService";
import type { ScenariosService } from "./ScenariosService";
import type { UserProfileService } from "../userData/UserProfileService";
import type { DatabaseService } from "../storage/DatabaseService";
import type { CoreIpcProcessClient } from "../core/CoreIpcProcessClient";

type ChatSessionServiceDeps = {
    browserService: BrowserService;
    userProfileService: UserProfileService;
    databaseService: DatabaseService;
    scenariosService: ScenariosService;
    coreClient: CoreIpcProcessClient;
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

        await this.deps.coreClient.runChatSession(
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

    async cancelSession(sessionId: string): Promise<boolean> {
        return this.deps.coreClient.cancelChatSession(sessionId);
    }

    async resolveCommandApproval(
        payload: ResolveCommandApprovalPayload,
    ): Promise<boolean> {
        return this.deps.coreClient.resolveCommandApproval(
            JSON.stringify(payload),
        );
    }

    async interruptCommandExec(callId: string): Promise<boolean> {
        return this.deps.coreClient.interruptCommandExec(callId);
    }

    private async handleHostCall(
        payload: Extract<NativeChatCallbackPayload, { kind: "host_call" }>,
    ): Promise<void> {
        try {
            const result = await this.executeHostMethod(
                payload.method,
                payload.args,
            );
            await this.deps.coreClient.submitToolResult(
                payload.request_id,
                JSON.stringify(result),
            );
        } catch (error) {
            await this.deps.coreClient.submitToolResult(
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

        if (method === "scenario.builder") {
            const action =
                typeof args.action === "string" ? args.action.trim() : "";
            if (!action) {
                throw new Error("scenario.builder requires action");
            }

            const scenarioId = this.resolveScenarioId(args);
            const scenario =
                this.deps.scenariosService.getScenarioById(scenarioId);

            if (!scenario) {
                return {
                    ok: false,
                    action,
                    scenarioId,
                    error: "not_found",
                    message: "Сценарий не найден",
                };
            }

            const scene = this.normalizeScene(scenario.content);

            if (action === "get_state") {
                return {
                    ok: true,
                    action,
                    scenarioId: scenario.id,
                    scene,
                };
            }

            if (action === "create_block") {
                const nextBlock = this.readJsonArg(args.block);
                if (!nextBlock || typeof nextBlock !== "object") {
                    throw new Error("create_block requires object in block");
                }

                const block = {
                    ...(nextBlock as Record<string, unknown>),
                    id:
                        typeof (nextBlock as Record<string, unknown>).id ===
                        "string"
                            ? (nextBlock as Record<string, unknown>).id
                            : `block_${randomUUID().replace(/-/g, "")}`,
                };

                scene.blocks.push(block);
                const updated = this.persistScenarioScene(scenario.id, scene);

                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    block,
                    message: `Блок ${String(block.id)} создан`,
                    blocksCount: scene.blocks.length,
                    connectionsCount: scene.connections.length,
                };
            }

            if (action === "update_block") {
                const block = this.readJsonArg(args.block);
                const blockId =
                    typeof args.blockId === "string" ? args.blockId.trim() : "";
                const patch =
                    block && typeof block === "object"
                        ? (block as Record<string, unknown>)
                        : null;

                const targetId =
                    blockId || (typeof patch?.id === "string" ? patch.id : "");
                if (!targetId || !patch) {
                    throw new Error(
                        "update_block requires blockId or block.id and block patch",
                    );
                }

                const index = scene.blocks.findIndex(
                    (item) =>
                        typeof item.id === "string" && item.id === targetId,
                );
                if (index < 0) {
                    return {
                        ok: false,
                        action,
                        scenarioId: scenario.id,
                        error: "not_found",
                        message: `Блок ${targetId} не найден`,
                    };
                }

                scene.blocks[index] = {
                    ...scene.blocks[index],
                    ...patch,
                    id: targetId,
                };

                const updated = this.persistScenarioScene(scenario.id, scene);
                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    block: scene.blocks[index],
                    message: `Блок ${targetId} обновлён`,
                    blocksCount: scene.blocks.length,
                    connectionsCount: scene.connections.length,
                };
            }

            if (action === "delete_block") {
                const blockId =
                    typeof args.blockId === "string" ? args.blockId.trim() : "";
                if (!blockId) {
                    throw new Error("delete_block requires blockId");
                }

                scene.blocks = scene.blocks.filter(
                    (item) => item.id !== blockId,
                );
                scene.connections = scene.connections.filter(
                    (item) =>
                        item.fromBlockId !== blockId &&
                        item.toBlockId !== blockId,
                );

                const updated = this.persistScenarioScene(scenario.id, scene);
                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    message: `Блок ${blockId} удалён`,
                    blocksCount: scene.blocks.length,
                    connectionsCount: scene.connections.length,
                };
            }

            if (action === "create_connection") {
                const input = this.readJsonArg(args.connection);
                if (!input || typeof input !== "object") {
                    throw new Error(
                        "create_connection requires object in connection",
                    );
                }

                const connection = {
                    ...(input as Record<string, unknown>),
                    id:
                        typeof (input as Record<string, unknown>).id ===
                        "string"
                            ? (input as Record<string, unknown>).id
                            : `connection_${randomUUID().replace(/-/g, "")}`,
                } as Record<string, unknown>;

                if (
                    typeof connection.fromBlockId !== "string" ||
                    typeof connection.toBlockId !== "string"
                ) {
                    throw new Error(
                        "create_connection requires fromBlockId and toBlockId",
                    );
                }

                scene.connections.push(connection);
                const updated = this.persistScenarioScene(scenario.id, scene);

                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    connection,
                    message: `Соединение ${String(connection.id)} создано`,
                    blocksCount: scene.blocks.length,
                    connectionsCount: scene.connections.length,
                };
            }

            if (action === "delete_connection") {
                const connectionId =
                    typeof args.connectionId === "string"
                        ? args.connectionId.trim()
                        : "";
                if (!connectionId) {
                    throw new Error("delete_connection requires connectionId");
                }

                scene.connections = scene.connections.filter(
                    (item) => item.id !== connectionId,
                );
                const updated = this.persistScenarioScene(scenario.id, scene);

                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    message: `Соединение ${connectionId} удалено`,
                    blocksCount: scene.blocks.length,
                    connectionsCount: scene.connections.length,
                };
            }

            if (action === "set_viewport") {
                const viewportPatch = this.readJsonArg(args.viewport);
                if (!viewportPatch || typeof viewportPatch !== "object") {
                    throw new Error("set_viewport requires object in viewport");
                }

                scene.viewport = {
                    ...scene.viewport,
                    ...(viewportPatch as Record<string, unknown>),
                };

                const updated = this.persistScenarioScene(scenario.id, scene);
                return {
                    ok: true,
                    action,
                    scenarioId: updated.id,
                    viewport: scene.viewport,
                    message: "Параметры viewport обновлены",
                };
            }

            return {
                ok: false,
                action,
                scenarioId: scenario.id,
                error: "validation",
                message: "Неизвестное действие scenario.builder",
            };
        }

        throw new Error(`Unsupported native host method: ${method}`);
    }

    private resolveScenarioId(args: Record<string, unknown>): string {
        const explicit =
            typeof args.scenarioId === "string" ? args.scenarioId.trim() : "";
        if (explicit) {
            return explicit;
        }

        const active =
            this.deps.userProfileService.getUserProfile().activeScenarioId ||
            "";
        if (!active) {
            throw new Error("scenario.builder requires active scenario");
        }

        return active;
    }

    private readJsonArg(value: unknown): unknown {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            return JSON.parse(trimmed) as unknown;
        }

        return value ?? null;
    }

    private normalizeScene(content: unknown): {
        version: 1;
        blocks: Record<string, unknown>[];
        connections: Record<string, unknown>[];
        viewport: Record<string, unknown>;
    } {
        const sceneCandidate =
            content &&
            typeof content === "object" &&
            !Array.isArray(content) &&
            "scene" in (content as Record<string, unknown>)
                ? (content as Record<string, unknown>).scene
                : null;
        const sceneObject =
            sceneCandidate &&
            typeof sceneCandidate === "object" &&
            !Array.isArray(sceneCandidate)
                ? (sceneCandidate as Record<string, unknown>)
                : {};

        const blocks = Array.isArray(sceneObject.blocks)
            ? (sceneObject.blocks as Record<string, unknown>[])
            : [];
        const connections = Array.isArray(sceneObject.connections)
            ? (sceneObject.connections as Record<string, unknown>[])
            : [];
        const viewportRaw =
            sceneObject.viewport &&
            typeof sceneObject.viewport === "object" &&
            !Array.isArray(sceneObject.viewport)
                ? (sceneObject.viewport as Record<string, unknown>)
                : {};

        return {
            version: 1,
            blocks,
            connections,
            viewport: {
                scale:
                    typeof viewportRaw.scale === "number"
                        ? viewportRaw.scale
                        : 1,
                offsetX:
                    typeof viewportRaw.offsetX === "number"
                        ? viewportRaw.offsetX
                        : 80,
                offsetY:
                    typeof viewportRaw.offsetY === "number"
                        ? viewportRaw.offsetY
                        : 80,
                showGrid:
                    typeof viewportRaw.showGrid === "boolean"
                        ? viewportRaw.showGrid
                        : true,
                canvasWidth:
                    typeof viewportRaw.canvasWidth === "number"
                        ? viewportRaw.canvasWidth
                        : 3200,
                canvasHeight:
                    typeof viewportRaw.canvasHeight === "number"
                        ? viewportRaw.canvasHeight
                        : 2000,
            },
        };
    }

    private persistScenarioScene(
        scenarioId: string,
        scene: {
            version: 1;
            blocks: Record<string, unknown>[];
            connections: Record<string, unknown>[];
            viewport: Record<string, unknown>;
        },
    ) {
        const current = this.deps.scenariosService.getScenarioById(scenarioId);
        if (!current) {
            throw new Error("Scenario not found while persisting scene");
        }

        const updated = this.deps.scenariosService.updateScenario(scenarioId, {
            name: current.name,
            description: current.description,
            content: {
                scene,
            },
        });

        if (!updated) {
            throw new Error("Failed to persist scenario scene");
        }

        return updated;
    }
}
