import type { OllamaMessage } from "../../../src/types/Chat";
import type {
    ChatSessionEvent,
    ResolveCommandApprovalPayload,
    RunChatSessionPayload,
    SendTelegramMessagePayload,
} from "../../../src/types/ElectronApi";
import { Config } from "../../../src/config";
import { fetchMireaScheduleByDate } from "../../../src/tools/studying/studying_schedule_mirea";
import type { CommandExecService } from "../CommandExecService";
import type { BrowserService } from "../BrowserService";
import type { FSystemService } from "../FSystemService";
import type { OllamaService } from "../agents/OllamaService";
import type { TelegramService } from "../communications/TelegramService";
import type { UserProfileService } from "../userData/UserProfileService";
import type { DatabaseService } from "../storage/DatabaseService";
import type { OllamaToolDefinition } from "../../../src/types/Chat";
import { getNativeCoreAddon } from "../core/nativeCoreAddon";
import type { ProjectsService } from "./ProjectsService";
import {
    clampVectorSearchLimit,
    toVectorSearchHits,
} from "../../../src/services/api/vectorSearchShared";

type ChatSessionServiceDeps = {
    ollamaService: OllamaService;
    commandExecService: CommandExecService;
    browserService: BrowserService;
    fSystemService: FSystemService;
    telegramService: TelegramService;
    userProfileService: UserProfileService;
    databaseService: DatabaseService;
    projectsService: ProjectsService;
};

type PlanStep = {
    id: number;
    description: string;
    completed: boolean;
};

type Plan = {
    id: string;
    title: string;
    steps: PlanStep[];
};

type PendingApproval = {
    sessionId: string;
    resolve: (accepted: boolean) => void;
};

type SessionState = {
    cancelled: boolean;
};

type RunChatSessionPayloadWithEnabledNames = RunChatSessionPayload & {
    enabledToolNames?: string[];
};

const planStore = new Map<string, Plan>();

const formatPlanResponse = (plan: Plan) => {
    const completed = plan.steps.filter((step) => step.completed);
    const pending = plan.steps.filter((step) => !step.completed);

    return {
        plan_id: plan.id,
        title: plan.title,
        progress: `${completed.length}/${plan.steps.length}`,
        completed_steps: completed.map((step) => ({
            id: step.id,
            description: step.description,
        })),
        pending_steps: pending.map((step) => ({
            id: step.id,
            description: step.description,
        })),
        next_step: pending[0] ?? null,
        is_complete: pending.length === 0,
    };
};

const toToolMessage = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value);

const commandMetaFromArgs = (args: Record<string, unknown>) => ({
    command: typeof args.command === "string" ? args.command : "",
    cwd: typeof args.cwd === "string" ? args.cwd : "",
    isAdmin: false,
});

const coreAddon = getNativeCoreAddon();

const getBuiltinToolDefinitions = (): OllamaToolDefinition[] => {
    const raw = coreAddon.getBuiltinToolDefinitions();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OllamaToolDefinition[]) : [];
};

const getBuiltinToolNames = (): string[] => {
    return getBuiltinToolDefinitions().map((tool) => tool.function.name);
};

export class ChatSessionService {
    private readonly pendingApprovals = new Map<string, PendingApproval>();
    private readonly sessions = new Map<string, SessionState>();

    constructor(private readonly deps: ChatSessionServiceDeps) {}

    async runSession(
        payload: RunChatSessionPayloadWithEnabledNames,
        emit: (event: ChatSessionEvent) => void,
    ): Promise<void> {
        const sessionId = payload.sessionId.trim();

        if (!sessionId) {
            throw new Error("sessionId is required");
        }

        const state: SessionState = { cancelled: false };
        this.sessions.set(sessionId, state);

        const builtInToolDefinitions = getBuiltinToolDefinitions();
        const builtInToolNames = new Set(getBuiltinToolNames());
        const requestedToolNames =
            payload.enabledToolNames && payload.enabledToolNames.length > 0
                ? payload.enabledToolNames
                : getBuiltinToolNames();
        const allowedTools = new Set(
            requestedToolNames.filter((toolName) =>
                builtInToolNames.has(toolName),
            ),
        );
        const effectiveToolDefinitions = builtInToolDefinitions.filter((tool) =>
            allowedTools.has(tool.function.name),
        );

        const maxToolCalls = Math.max(1, payload.maxToolCalls || 1);
        let toolCallsUsed = 0;

        const messages: OllamaMessage[] = [...(payload.messages || [])];

        try {
            while (!state.cancelled) {
                let roundContent = "";
                let roundThinking = "";
                const roundToolCalls: Array<{
                    type?: "function";
                    function: {
                        index?: number;
                        name: string;
                        arguments: Record<string, unknown>;
                    };
                }> = [];

                let roundUsage: {
                    promptTokens: number;
                    completionTokens: number;
                    totalTokens: number;
                } | null = null;

                for await (const chunk of this.deps.ollamaService.streamChat(
                    {
                        model: payload.model,
                        messages,
                        ...(effectiveToolDefinitions.length > 0
                            ? { tools: effectiveToolDefinitions }
                            : {}),
                        ...(payload.format ? { format: payload.format } : {}),
                        ...(payload.think !== undefined
                            ? { think: payload.think }
                            : {}),
                    },
                    this.deps.userProfileService.getUserProfile().ollamaToken,
                )) {
                    if (state.cancelled) {
                        break;
                    }

                    const thinkingChunk = chunk.message?.thinking || "";
                    const contentChunk = chunk.message?.content || "";

                    if (thinkingChunk) {
                        roundThinking += thinkingChunk;
                        emit({
                            sessionId,
                            type: "thinking.delta",
                            chunkText: thinkingChunk,
                        });
                    }

                    if (contentChunk) {
                        roundContent += contentChunk;
                        emit({
                            sessionId,
                            type: "content.delta",
                            chunkText: contentChunk,
                        });
                    }

                    if (chunk.message?.tool_calls?.length) {
                        roundToolCalls.push(...chunk.message.tool_calls);
                    }

                    if (chunk.done) {
                        const promptTokens = Math.max(
                            0,
                            Number(chunk.prompt_eval_count ?? 0),
                        );
                        const completionTokens = Math.max(
                            0,
                            Number(chunk.eval_count ?? 0),
                        );
                        const totalTokens = promptTokens + completionTokens;

                        if (totalTokens > 0) {
                            roundUsage = {
                                promptTokens,
                                completionTokens,
                                totalTokens,
                            };
                        }
                    }
                }

                if (state.cancelled) {
                    break;
                }

                if (roundToolCalls.length === 0) {
                    if (roundUsage) {
                        emit({
                            sessionId,
                            type: "usage",
                            promptTokens: roundUsage.promptTokens,
                            completionTokens: roundUsage.completionTokens,
                            totalTokens: roundUsage.totalTokens,
                        });
                    }

                    emit({ sessionId, type: "done" });
                    return;
                }

                messages.push({
                    role: "assistant",
                    thinking: roundThinking,
                    content: roundContent,
                    tool_calls: roundToolCalls,
                });

                for (const toolCall of roundToolCalls) {
                    if (state.cancelled) {
                        break;
                    }

                    if (toolCallsUsed >= maxToolCalls) {
                        throw new Error(
                            `Превышен лимит вызовов инструментов (${maxToolCalls})`,
                        );
                    }

                    const toolName = toolCall.function.name;
                    const args = toolCall.function.arguments || {};
                    const callId = `${sessionId}:tool_call_${toolCallsUsed + 1}`;

                    if (!allowedTools.has(toolName)) {
                        throw new Error(
                            `Tool ${toolName} недоступен в текущем чате`,
                        );
                    }

                    emit({
                        sessionId,
                        type: "tool.call",
                        callId,
                        toolName,
                        args,
                    });

                    const result = await this.executeTool(
                        sessionId,
                        callId,
                        toolName,
                        args,
                        payload,
                        state,
                    );

                    emit({
                        sessionId,
                        type: "tool.result",
                        callId,
                        toolName,
                        args,
                        result,
                    });

                    messages.push({
                        role: "tool",
                        tool_name: toolName,
                        content: toToolMessage(result),
                    });

                    toolCallsUsed += 1;
                }
            }

            emit({ sessionId, type: "done" });
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Не удалось получить ответ модели";

            emit({
                sessionId,
                type: "error",
                message: errorMessage,
            });

            throw error;
        } finally {
            this.sessions.delete(sessionId);

            for (const [callId, pending] of this.pendingApprovals.entries()) {
                if (pending.sessionId !== sessionId) {
                    continue;
                }

                this.pendingApprovals.delete(callId);
                pending.resolve(false);
            }
        }
    }

    cancelSession(sessionId: string): boolean {
        const state = this.sessions.get(sessionId);

        if (!state) {
            return false;
        }

        state.cancelled = true;

        for (const [callId, pending] of this.pendingApprovals.entries()) {
            if (pending.sessionId !== sessionId) {
                continue;
            }

            this.pendingApprovals.delete(callId);
            pending.resolve(false);
        }

        return true;
    }

    resolveCommandApproval(payload: ResolveCommandApprovalPayload): boolean {
        const callId =
            typeof payload.callId === "string" ? payload.callId.trim() : "";
        const pending = this.pendingApprovals.get(callId);

        if (!pending) {
            return false;
        }

        this.pendingApprovals.delete(callId);
        pending.resolve(payload.accepted === true);
        return true;
    }

    private async executeTool(
        sessionId: string,
        callId: string,
        toolName: string,
        args: Record<string, unknown>,
        payload: RunChatSessionPayload,
        state: SessionState,
    ): Promise<unknown> {
        if (toolName === "command_exec") {
            const approved = await this.waitCommandApproval(sessionId, callId);
            const { command, cwd, isAdmin } = commandMetaFromArgs(args);

            if (!approved) {
                return {
                    status: "cancelled",
                    command,
                    cwd,
                    isAdmin,
                    reason: "Пользователь отклонил выполнение",
                };
            }

            return this.deps.commandExecService.execute(
                command,
                cwd || undefined,
            );
        }

        if (state.cancelled) {
            return { status: "cancelled" };
        }

        if (toolName === "vector_store_search_tool") {
            return this.searchVectorStore(args, payload);
        }

        if (toolName === "web_search") {
            const request =
                typeof args.request === "string" ? args.request : "";
            return this.postOllamaTool("web_search", {
                query: request,
            });
        }

        if (toolName === "web_fetch") {
            const url = typeof args.url === "string" ? args.url : "";
            return this.postOllamaTool("web_fetch", { url });
        }

        if (toolName === "open_url") {
            const url = typeof args.url === "string" ? args.url : "";
            const timeoutMs =
                typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
            return this.deps.browserService.openUrl(url, timeoutMs);
        }

        if (toolName === "get_page_snapshot") {
            const maxElements =
                typeof args.maxElements === "number"
                    ? args.maxElements
                    : undefined;
            return this.deps.browserService.getPageSnapshot(maxElements);
        }

        if (toolName === "interact_with") {
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

        if (toolName === "close_browser") {
            return this.deps.browserService.closeSession();
        }

        if (toolName === "send_telegram_msg") {
            const profile = this.deps.userProfileService.getUserProfile();
            const payloadToSend: SendTelegramMessagePayload = {
                telegramBotToken: profile.telegramBotToken,
                telegramId: profile.telegramId,
                message: typeof args.message === "string" ? args.message : "",
                parseMode:
                    args.parse_mode === "HTML" ||
                    args.parse_mode === "MarkdownV2"
                        ? args.parse_mode
                        : "Markdown",
            };

            if (!payloadToSend.telegramBotToken || !payloadToSend.telegramId) {
                return {
                    success: false,
                    error: "missing_config",
                    message:
                        "Telegram не настроен. Укажи Bot Token и ID пользователя в настройках.",
                };
            }

            return this.deps.telegramService.sendMessage(payloadToSend);
        }

        if (toolName === "get_telegram_unread_msgs") {
            const profile = this.deps.userProfileService.getUserProfile();

            if (!profile.telegramBotToken || !profile.telegramId) {
                return {
                    success: false,
                    error: "missing_config",
                    message:
                        "Telegram не настроен. Укажи Bot Token и ID пользователя в настройках.",
                };
            }

            return this.deps.telegramService.getUnreadMessages({
                telegramBotToken: profile.telegramBotToken,
                telegramId: profile.telegramId,
                limit: typeof args.limit === "number" ? args.limit : undefined,
                markAsRead:
                    typeof args.mark_as_read === "boolean"
                        ? args.mark_as_read
                        : undefined,
            });
        }

        if (toolName === "list_directory") {
            const cwd = typeof args.cwd === "string" ? args.cwd.trim() : "";

            if (!cwd) {
                return { error: "Необходимо указать параметр cwd." };
            }

            return this.deps.fSystemService.listDirectory(cwd);
        }

        if (toolName === "create_file") {
            const cwd = typeof args.cwd === "string" ? args.cwd.trim() : "";
            const filename =
                typeof args.filename === "string" ? args.filename.trim() : "";
            const content =
                typeof args.content === "string" ? args.content : "";

            if (!cwd || !filename) {
                return { error: "Необходимо указать cwd и filename." };
            }

            return this.deps.fSystemService.createFile(cwd, filename, content);
        }

        if (toolName === "create_dir") {
            const cwd = typeof args.cwd === "string" ? args.cwd.trim() : "";
            const dirname =
                typeof args.dirname === "string" ? args.dirname.trim() : "";

            if (!cwd || !dirname) {
                return { error: "Необходимо указать cwd и dirname." };
            }

            return this.deps.fSystemService.createDir(cwd, dirname);
        }

        if (toolName === "read_file") {
            const filePath =
                typeof args.filePath === "string" ? args.filePath.trim() : "";
            const readAll =
                typeof args.readAll === "boolean" ? args.readAll : true;
            const fromLine =
                typeof args.readFromRow === "number"
                    ? args.readFromRow
                    : undefined;
            const toLine =
                typeof args.readToRow === "number" ? args.readToRow : undefined;

            if (!filePath) {
                return { error: "Необходимо указать filePath." };
            }

            return this.deps.fSystemService.readTextFileRange(
                filePath,
                readAll,
                fromLine,
                toLine,
            );
        }

        if (toolName === "qa_tool") {
            const question =
                typeof args.question === "string" ? args.question : "";
            const reason = typeof args.reason === "string" ? args.reason : "";
            const selectAnswers = Array.isArray(args.selectAnswers)
                ? args.selectAnswers.filter(
                      (value): value is string => typeof value === "string",
                  )
                : [];
            const userAnswer =
                typeof args.userAnswer === "string" ? args.userAnswer : "";

            return {
                status: "awaiting_user_response",
                question,
                reason,
                selectAnswers,
                userAnswer,
                instruction:
                    "Задай пользователю этот вопрос и дождись ответа в чате перед продолжением.",
            };
        }

        if (toolName === "planning_tool") {
            return this.executePlanningTool(args);
        }

        if (toolName === "schedule_mirea_tool") {
            const dateValue =
                typeof args.date_value === "string"
                    ? args.date_value.trim()
                    : "";

            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                throw new Error(
                    "Parameter date_value must be in YYYY-MM-DD format",
                );
            }

            return fetchMireaScheduleByDate(
                `${Config.MIREA_BASE_URL}/?date=${dateValue}&s=1_778`,
                dateValue,
            );
        }

        throw new Error(`Tool ${toolName} не поддерживается в main runtime`);
    }

    private async searchVectorStore(
        args: Record<string, unknown>,
        payload: RunChatSessionPayload,
    ) {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) {
            throw new Error("Поисковый запрос пуст");
        }

        const profile = this.deps.userProfileService.getUserProfile();
        const activeProjectId =
            payload.runtimeContext?.activeProjectId ||
            profile.activeProjectId ||
            "";

        if (!activeProjectId) {
            throw new Error(
                "vector_store_search_tool доступен только в чате проекта",
            );
        }

        const topK = clampVectorSearchLimit(args.limit ?? args.topK, 5);

        const project =
            this.deps.projectsService.getProjectById(activeProjectId);
        const vectorStorageId = project?.vecStorId?.trim() || "";

        if (!vectorStorageId) {
            throw new Error(
                "К текущему проекту не подключено векторное хранилище",
            );
        }

        const token = payload.runtimeContext?.zvsAccessToken?.trim() || "";
        const result = await this.deps.ollamaService.getEmbed(
            vectorStorageId,
            {
                query,
                topK,
            },
            token,
        );
        const items = Array.isArray(result.items) ? result.items : [];
        const hits = toVectorSearchHits(items);

        return {
            vectorStorageId,
            hits,
            items,
            request: {
                query,
                topK,
                storageId: vectorStorageId,
                projectId: activeProjectId,
            },
        };
    }

    private async postOllamaTool(
        endpoint: "web_search" | "web_fetch",
        payload: Record<string, unknown>,
    ): Promise<unknown> {
        const profile = this.deps.userProfileService.getUserProfile();
        const token = profile.ollamaToken.trim();
        const baseUrl = Config.OLLAMA_BASE_URL.trim().replace(/\/$/, "");

        const response = await fetch(`${baseUrl}/api/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
        });

        const bodyText = await response.text();

        if (!response.ok) {
            throw new Error(
                bodyText || `${endpoint} failed (${response.status})`,
            );
        }

        if (!bodyText.trim()) {
            return {};
        }

        try {
            return JSON.parse(bodyText) as unknown;
        } catch {
            return {
                result: bodyText,
            };
        }
    }

    private waitCommandApproval(
        sessionId: string,
        callId: string,
    ): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.pendingApprovals.set(callId, {
                sessionId,
                resolve,
            });
        });
    }

    private executePlanningTool(args: Record<string, unknown>) {
        const action = typeof args.action === "string" ? args.action : "";

        if (action === "create") {
            const title =
                typeof args.title === "string" && args.title.trim()
                    ? args.title.trim()
                    : "Без названия";
            const rawSteps = Array.isArray(args.steps)
                ? args.steps.filter(
                      (step): step is string => typeof step === "string",
                  )
                : [];

            if (rawSteps.length === 0) {
                return {
                    error: "Необходимо передать хотя бы один шаг в поле 'steps'.",
                };
            }

            const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const plan: Plan = {
                id,
                title,
                steps: rawSteps.map((description, index) => ({
                    id: index + 1,
                    description,
                    completed: false,
                })),
            };

            planStore.set(id, plan);
            return {
                ...formatPlanResponse(plan),
                instruction:
                    "План создан. Выполняй шаги строго по порядку. После каждого шага вызывай complete_step с соответствующим step_id.",
            };
        }

        if (action === "complete_step") {
            const planId = typeof args.plan_id === "string" ? args.plan_id : "";
            const stepId =
                typeof args.step_id === "number" ? args.step_id : null;
            const plan = planStore.get(planId);

            if (!plan) {
                return {
                    error: `План с id '${planId}' не найден. Сначала создай план через action='create'.`,
                };
            }

            if (stepId === null) {
                return {
                    error: "Необходимо указать step_id — номер выполненного шага.",
                };
            }

            const step = plan.steps.find((item) => item.id === stepId);

            if (!step) {
                return {
                    error: `Шаг с id=${stepId} не найден в плане '${plan.title}'.`,
                };
            }

            if (step.completed) {
                return {
                    warning: `Шаг ${stepId} уже был отмечен как выполненный.`,
                    ...formatPlanResponse(plan),
                };
            }

            step.completed = true;
            const response = formatPlanResponse(plan);

            return {
                ...response,
                instruction: response.is_complete
                    ? "Все шаги выполнены. План завершён."
                    : `Шаг ${stepId} отмечен выполненным. Следующий шаг: #${response.next_step?.id} — ${response.next_step?.description}`,
            };
        }

        if (action === "get_status") {
            const planId = typeof args.plan_id === "string" ? args.plan_id : "";
            const plan = planStore.get(planId);

            if (!plan) {
                return {
                    error: `План с id '${planId}' не найден.`,
                };
            }

            return formatPlanResponse(plan);
        }

        return {
            error: `Неизвестное действие '${action}'. Используй: 'create', 'complete_step', 'get_status'.`,
        };
    }
}
