import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChatParams } from "../useChatParams";
import { useToasts } from "../useToasts";
import { useUserProfile } from "../useUserProfile";
import type { ChatDriver } from "../../types/App";
import type { AssistantStage, ChatDialog, ChatMessage } from "../../types/Chat";
import type { TokenUsage } from "../../types/Chat";
import { createOllamaAdapter } from "./adapters/ollamaAdapter";
import type { ChatProviderAdapter } from "../../types/AIRequests";
import { chatsStore } from "../../stores/chatsStore";
import { toolsStore } from "../../stores/toolsStore";
import { projectsStore } from "../../stores/projectsStore";
import { commandExecApprovalService } from "../../services/commandExecApproval";
import { parseScenarioLaunchPayload } from "../../utils/scenario/scenarioLaunchEnvelope";
import {
    buildScenarioRuntimeEnvText,
    createMessageId,
    getCommandRequestMeta,
    getScenarioFormatHint,
    getTimeStamp,
} from "../../utils/chat/chatStream";
import { createChatChunkQueueManager } from "../../utils/chat/chatChunkQueue";
import {
    getSystemPrompt,
    getUserPrompt,
    getProjectPrompt,
} from "../../prompts/base";

const TOOL_STAGE_BY_NAME: Record<string, AssistantStage> = {
    planning_tool: "planning",
    qa_tool: "questioning",
};

const resolveToolStage = (toolName: string): AssistantStage => {
    return TOOL_STAGE_BY_NAME[toolName] || "tools_calling";
};

export function useChat() {
    const { userProfile: chatParamsProfile } = useChatParams();
    const { chatDriver, ollamaModel, ollamaToken } = chatParamsProfile;
    const { userProfile } = useUserProfile();
    const toasts = useToasts();

    const [isAwaitingFirstChunk, setIsAwaitingFirstChunk] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [activeStage, setActiveStage] = useState<AssistantStage | null>(null);
    const [activeResponseToId, setActiveResponseToId] = useState<string | null>(
        null,
    );
    const messages = chatsStore.messages;
    const visibleMessages = useMemo(
        () =>
            messages.filter(
                (message) => message.author !== "system" && !message.hidden,
            ),
        [messages],
    );
    const messagesRef = useRef<ChatMessage[]>(messages);
    const activeDialogRef = useRef<ChatDialog | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const cancellationRequestedRef = useRef(false);
    const isSendInFlightRef = useRef(false);

    const providers = useMemo<
        Partial<Record<Exclude<ChatDriver, "">, ChatProviderAdapter>>
    >(
        () => ({
            ollama: createOllamaAdapter({
                model: ollamaModel,
            }),
        }),
        [ollamaModel],
    );

    const commitMessages = (nextMessages: ChatMessage[]) => {
        messagesRef.current = nextMessages;
        chatsStore.setMessages(nextMessages);
    };

    const updateMessages = (
        updater: (prev: ChatMessage[]) => ChatMessage[],
    ) => {
        const next = updater(messagesRef.current);
        messagesRef.current = next;
        chatsStore.setMessages(next);
    };

    const ensureDialog = (): ChatDialog => {
        if (chatsStore.activeDialog) {
            activeDialogRef.current = chatsStore.activeDialog;
            return chatsStore.activeDialog;
        }

        if (activeDialogRef.current) {
            return activeDialogRef.current;
        }

        const now = new Date().toISOString();
        const fallbackDialog: ChatDialog = {
            id: `dialog_${crypto.randomUUID().replace(/-/g, "")}`,
            title: "Новый диалог",
            forProjectId: null,
            messages: messagesRef.current,
            createdAt: now,
            updatedAt: now,
        };

        activeDialogRef.current = fallbackDialog;
        chatsStore.replaceByDialog(fallbackDialog);
        return fallbackDialog;
    };

    useEffect(() => {
        chatsStore.initialize();
    }, []);

    messagesRef.current = chatsStore.messages;
    activeDialogRef.current = chatsStore.activeDialog;

    const sendMessageMutation = useMutation({
        mutationFn: async (rawContent: string) => {
            if (isSendInFlightRef.current) {
                return;
            }

            isSendInFlightRef.current = true;

            try {
                const isHiddenQa = rawContent.startsWith("__qa_hidden__");
                const content = isHiddenQa
                    ? rawContent.slice("__qa_hidden__".length).trim()
                    : rawContent.trim();
                const scenarioLaunchPayload =
                    parseScenarioLaunchPayload(content);
                const scenarioFormatHint = getScenarioFormatHint(
                    scenarioLaunchPayload?.scenarioFlow,
                );
                const scenarioRuntimeEnvText = scenarioLaunchPayload
                    ? buildScenarioRuntimeEnvText(
                          projectsStore.activeProject?.directoryPath,
                      )
                    : "";
                const userVisibleContent =
                    scenarioLaunchPayload?.displayMessage || content;

                if (!userVisibleContent) {
                    return;
                }

                if (!chatDriver) {
                    toasts.danger({
                        title: "Провайдер не выбран",
                        description:
                            "Выберите провайдер в настройках чата перед отправкой сообщения.",
                    });
                    return;
                }

                const adapter =
                    providers[chatDriver as Exclude<ChatDriver, "">];
                if (!adapter) {
                    toasts.danger({
                        title: "Провайдер не поддерживается",
                        description:
                            "Для выбранного провайдера ещё не подключён адаптер.",
                    });
                    return;
                }

                const userMessage: ChatMessage = {
                    id: createMessageId(),
                    author: "user",
                    content: userVisibleContent,
                    timestamp: getTimeStamp(),
                    ...(isHiddenQa ? { hidden: true } : {}),
                };

                const currentDialog = ensureDialog();

                const requestBaseHistory = [...messagesRef.current];
                const isFirstDialogMessage = requestBaseHistory.length === 0;
                const activeProject = projectsStore.activeProject;
                const shouldAttachProjectPrompt =
                    activeProject?.dialogId === currentDialog.id;
                const activeProjectId =
                    shouldAttachProjectPrompt && activeProject?.id
                        ? activeProject.id
                        : "";

                let hasConnectedVectorStorage = false;
                if (activeProjectId) {
                    const vectorStoragesApi = window.appApi?.vectorStorages;

                    if (vectorStoragesApi) {
                        const vectorStorages =
                            await vectorStoragesApi.getVectorStorages();
                        hasConnectedVectorStorage = vectorStorages.some(
                            (vectorStorage) =>
                                vectorStorage.usedByProjects.some(
                                    (projectRef) =>
                                        projectRef.id === activeProjectId,
                                ),
                        );
                    }
                }

                const requestTools = hasConnectedVectorStorage
                    ? toolsStore.toolDefinitions
                    : toolsStore.getToolDefinitions([
                          "vector_store_search_tool",
                      ]);
                const allowedToolNames = new Set(
                    requestTools.map((tool) => tool.function.name),
                );
                const requiredToolsInstruction =
                    toolsStore.requiredPromptInstruction;

                const initialSystemMessages: ChatMessage[] =
                    isFirstDialogMessage
                        ? [
                              {
                                  id: createMessageId(),
                                  author: "system",
                                  content: getSystemPrompt(
                                      userProfile.assistantName,
                                  ),
                                  timestamp: getTimeStamp(),
                              },
                              {
                                  id: createMessageId(),
                                  author: "system",
                                  content: getUserPrompt(
                                      userProfile.userName,
                                      userProfile.userPrompt,
                                      userProfile.userLanguage,
                                  ),
                                  timestamp: getTimeStamp(),
                              },
                              ...(shouldAttachProjectPrompt
                                  ? [
                                        {
                                            id: createMessageId(),
                                            author: "system" as const,
                                            content: getProjectPrompt(
                                                activeProject.name,
                                                activeProject.description,
                                                activeProject.directoryPath,
                                            ),
                                            timestamp: getTimeStamp(),
                                        },
                                    ]
                                  : []),
                          ]
                        : [];

                const historyForStorage = [
                    ...initialSystemMessages,
                    ...requestBaseHistory,
                    ...(scenarioLaunchPayload
                        ? [
                              {
                                  id: createMessageId(),
                                  author: "system" as const,
                                  content: [
                                      `SCENARIO_LAUNCH: ${scenarioLaunchPayload.scenarioName}`,
                                      scenarioLaunchPayload.scenarioFlow,
                                      scenarioRuntimeEnvText,
                                      "Instruction: execute scenario flow strictly by graph links. If data is missing, ask one clear question via qa_tool or plain assistant question.",
                                  ].join("\n\n"),
                                  timestamp: getTimeStamp(),
                              },
                          ]
                        : []),
                    userMessage,
                ];
                const requestConstraintMessages: ChatMessage[] = [
                    ...(requiredToolsInstruction
                        ? [
                              {
                                  id: createMessageId(),
                                  author: "system" as const,
                                  content: requiredToolsInstruction,
                                  timestamp: getTimeStamp(),
                              },
                          ]
                        : []),
                    ...(hasConnectedVectorStorage
                        ? [
                              {
                                  id: createMessageId(),
                                  author: "system" as const,
                                  content:
                                      "PROJECT_VECTOR_SEARCH_POLICY: In this project chat you must always use vector_store_search_tool before producing a final answer when the task can depend on project documents or project facts.",
                                  timestamp: getTimeStamp(),
                              },
                          ]
                        : []),
                ];

                const historyForRequest = [
                    ...historyForStorage,
                    ...requestConstraintMessages,
                ];
                const chunkQueueManager = createChatChunkQueueManager({
                    answeringAt: userMessage.id,
                    updateMessages,
                });

                const setStreamStage = (stage: AssistantStage) => {
                    setActiveStage((previous) =>
                        previous === stage ? previous : stage,
                    );
                };

                commitMessages(historyForStorage);
                setIsStreaming(true);
                setIsAwaitingFirstChunk(true);
                setActiveResponseToId(userMessage.id);
                setActiveStage("thinking");
                cancellationRequestedRef.current = false;
                const abortController = new AbortController();
                abortControllerRef.current = abortController;
                const toolTraceMessageIds = new Map<string, string>();
                const isCurrentAnswerMessage = (message: ChatMessage) =>
                    message.author === "assistant" &&
                    message.assistantStage === "answering" &&
                    message.answeringAt === userMessage.id;

                let hasFirstChunk = false;
                let responseUsage: TokenUsage = {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                };
                const markFirstActivity = () => {
                    if (hasFirstChunk) {
                        return;
                    }

                    hasFirstChunk = true;
                    setIsAwaitingFirstChunk(false);
                };

                try {
                    await adapter.send({
                        history: historyForRequest,
                        tools: requestTools,
                        ...(scenarioFormatHint
                            ? { format: scenarioFormatHint }
                            : {}),
                        maxToolCalls:
                            userProfile.maxToolCallsPerResponse > 0
                                ? userProfile.maxToolCallsPerResponse
                                : 1,
                        executeTool: async (toolName, args, meta) => {
                            if (!allowedToolNames.has(toolName)) {
                                throw new Error(
                                    `Tool ${toolName} недоступен в текущем чате`,
                                );
                            }

                            if (toolName !== "command_exec") {
                                return await toolsStore.executeTool(
                                    toolName,
                                    args,
                                    {
                                        ollamaToken: ollamaToken,
                                        telegramId: userProfile.telegramId,
                                        telegramBotToken:
                                            userProfile.telegramBotToken,
                                        scenarioRuntimeEnv: {
                                            current_date:
                                                new Date().toISOString(),
                                            project_directory:
                                                projectsStore.activeProject
                                                    ?.directoryPath ?? "",
                                        },
                                    },
                                );
                            }

                            const messageId = toolTraceMessageIds.get(
                                meta.callId,
                            );
                            const { command, cwd, isAdmin } =
                                getCommandRequestMeta(args);

                            if (!messageId) {
                                return {
                                    status: "cancelled",
                                    command,
                                    cwd,
                                    isAdmin,
                                    reason: "Не найдена карточка подтверждения",
                                };
                            }

                            const approved =
                                await commandExecApprovalService.waitForDecision(
                                    messageId,
                                );

                            updateMessages((prev) =>
                                prev.map((message) =>
                                    message.id === messageId &&
                                    message.toolTrace
                                        ? {
                                              ...message,
                                              toolTrace: {
                                                  ...message.toolTrace,
                                                  status: approved
                                                      ? "accepted"
                                                      : "cancelled",
                                              },
                                          }
                                        : message,
                                ),
                            );

                            if (!approved) {
                                return {
                                    status: "cancelled",
                                    command,
                                    cwd,
                                    isAdmin,
                                    reason: "Пользователь отклонил выполнение",
                                };
                            }

                            return await toolsStore.executeTool(
                                toolName,
                                args,
                                {
                                    ollamaToken: ollamaToken,
                                    telegramId: userProfile.telegramId,
                                    telegramBotToken:
                                        userProfile.telegramBotToken,
                                    scenarioRuntimeEnv: {
                                        current_date: new Date().toISOString(),
                                        project_directory:
                                            projectsStore.activeProject
                                                ?.directoryPath ?? "",
                                    },
                                },
                            );
                        },
                        onToolCall: ({ callId, toolName, args }) => {
                            chunkQueueManager.flushImmediate();
                            const toolStage = resolveToolStage(toolName);
                            setStreamStage(toolStage);
                            markFirstActivity();
                            const messageId = createMessageId();
                            toolTraceMessageIds.set(callId, messageId);
                            const commandMeta =
                                toolName === "command_exec"
                                    ? getCommandRequestMeta(args)
                                    : null;

                            updateMessages((prev) => [
                                ...prev,
                                {
                                    id: messageId,
                                    author: "assistant",
                                    assistantStage: toolStage,
                                    answeringAt: userMessage.id,
                                    toolTrace: {
                                        callId,
                                        toolName,
                                        args,
                                        result: null,
                                        ...(toolName === "command_exec"
                                            ? {
                                                  status: "pending" as const,
                                                  command: commandMeta?.command,
                                                  cwd: commandMeta?.cwd,
                                                  isAdmin: commandMeta?.isAdmin,
                                              }
                                            : {}),
                                    },
                                    content: "",
                                    timestamp: getTimeStamp(),
                                },
                            ]);
                        },
                        onToolResult: ({ callId, toolName, args, result }) => {
                            chunkQueueManager.flushImmediate();
                            const toolStage = resolveToolStage(toolName);
                            setStreamStage(toolStage);
                            const messageId = toolTraceMessageIds.get(callId);

                            updateMessages((prev) => {
                                if (!messageId) {
                                    return [
                                        ...prev,
                                        {
                                            id: createMessageId(),
                                            author: "assistant",
                                            assistantStage: toolStage,
                                            answeringAt: userMessage.id,
                                            toolTrace: {
                                                callId,
                                                toolName,
                                                args,
                                                result,
                                                status:
                                                    toolName === "command_exec"
                                                        ? "cancelled"
                                                        : "accepted",
                                                ...(toolName === "command_exec"
                                                    ? getCommandRequestMeta(
                                                          args,
                                                      )
                                                    : {}),
                                            },
                                            content: "",
                                            timestamp: getTimeStamp(),
                                        },
                                    ];
                                }

                                return prev.map((message) =>
                                    message.id === messageId
                                        ? {
                                              ...message,
                                              assistantStage: toolStage,
                                              toolTrace: {
                                                  callId,
                                                  toolName,
                                                  args,
                                                  result,
                                                  status:
                                                      message.toolTrace
                                                          ?.status ||
                                                      (toolName ===
                                                      "command_exec"
                                                          ? "cancelled"
                                                          : "accepted"),
                                                  ...(toolName ===
                                                  "command_exec"
                                                      ? getCommandRequestMeta(
                                                            args,
                                                        )
                                                      : {}),
                                              },
                                              content: "",
                                          }
                                        : message,
                                );
                            });
                        },
                        onThinkingChunk: (chunkText) => {
                            if (!chunkText) {
                                return;
                            }

                            setStreamStage("thinking");
                            markFirstActivity();
                            chunkQueueManager.enqueue("thinking", chunkText);
                        },
                        signal: abortController.signal,
                        onUsage: (usage) => {
                            responseUsage = {
                                promptTokens: Math.max(0, usage.promptTokens),
                                completionTokens: Math.max(
                                    0,
                                    usage.completionTokens,
                                ),
                                totalTokens: Math.max(0, usage.totalTokens),
                            };
                        },
                        onChunk: (chunkText, done) => {
                            if (!chunkText) {
                                if (done) {
                                    setIsAwaitingFirstChunk(false);
                                }
                                return;
                            }

                            setStreamStage("answering");
                            markFirstActivity();

                            chunkQueueManager.enqueue("answering", chunkText);
                        },
                    });

                    await chunkQueueManager.waitForDrain();

                    const snapshot: ChatDialog = {
                        ...currentDialog,
                        messages: messagesRef.current,
                        tokenUsage: {
                            promptTokens:
                                Math.max(
                                    0,
                                    currentDialog.tokenUsage?.promptTokens ?? 0,
                                ) + responseUsage.promptTokens,
                            completionTokens:
                                Math.max(
                                    0,
                                    currentDialog.tokenUsage
                                        ?.completionTokens ?? 0,
                                ) + responseUsage.completionTokens,
                            totalTokens:
                                Math.max(
                                    0,
                                    currentDialog.tokenUsage?.totalTokens ?? 0,
                                ) + responseUsage.totalTokens,
                        },
                        updatedAt: new Date().toISOString(),
                    };

                    const savedDialog = await chatsStore.saveSnapshot(snapshot);
                    activeDialogRef.current = savedDialog;
                    commitMessages(savedDialog.messages);
                } catch (error) {
                    if (
                        cancellationRequestedRef.current &&
                        error instanceof Error &&
                        error.name === "AbortError"
                    ) {
                        chunkQueueManager.reset();
                        commitMessages(requestBaseHistory);
                        return;
                    }

                    await chunkQueueManager.waitForDrain();

                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Не удалось получить ответ модели";

                    updateMessages((prev) => {
                        const lastMessage = prev[prev.length - 1];

                        if (
                            !lastMessage ||
                            !isCurrentAnswerMessage(lastMessage)
                        ) {
                            return [
                                ...prev,
                                {
                                    id: createMessageId(),
                                    author: "assistant",
                                    assistantStage: "answering",
                                    answeringAt: userMessage.id,
                                    content: `Ошибка: ${errorMessage}`,
                                    timestamp: getTimeStamp(),
                                },
                            ];
                        }

                        const updatedLastMessage: ChatMessage = {
                            ...lastMessage,
                            content: `Ошибка: ${errorMessage}`,
                        };

                        return [...prev.slice(0, -1), updatedLastMessage];
                    });
                } finally {
                    chunkQueueManager.reset();
                    abortControllerRef.current = null;
                    cancellationRequestedRef.current = false;
                    setIsAwaitingFirstChunk(false);
                    setIsStreaming(false);
                    setActiveStage(null);
                    setActiveResponseToId(null);
                }
            } finally {
                isSendInFlightRef.current = false;
            }
        },
    });

    const cancelGeneration = () => {
        const controller = abortControllerRef.current;

        if (!controller) {
            return;
        }

        cancellationRequestedRef.current = true;
        controller.abort();
    };

    return {
        messages: visibleMessages,
        sendMessage: sendMessageMutation.mutate,
        cancelGeneration,
        isStreaming,
        isAwaitingFirstChunk,
        activeStage,
        activeResponseToId,
    };
}
