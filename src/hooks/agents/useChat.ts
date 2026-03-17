import { useEffect, useMemo, useRef, useState } from "react";
import { useChatParams } from "../useChatParams";
import { useToasts } from "../useToasts";
import { useUserProfile } from "../useUserProfile";
import type { AssistantStage, ChatDialog, ChatMessage } from "../../types/Chat";
import type { TokenUsage } from "../../types/Chat";
import type {
    ChatSessionEvent,
    RunChatSessionPayload,
} from "../../types/ElectronApi";
import { chatsStore } from "../../stores/chatsStore";
import { chatRuntimeStore } from "../../stores/chatRuntimeStore.ts";
import { toolsStore } from "../../stores/toolsStore";
import { projectsStore } from "../../stores/projectsStore";
import { parseScenarioLaunchPayload } from "../../utils/scenario/scenarioLaunchEnvelope";
import {
    buildScenarioRuntimeEnvText,
    createMessageId,
    getCommandRequestMeta,
    getScenarioFormatHint,
    getTimeStamp,
} from "../../utils/chat/chatStream";
import { createChatChunkQueueManager } from "../../utils/chat/chatChunkQueue";
import { inferToolTraceStatus } from "../../utils/chat/toolExecution";
import {
    getSystemPrompt,
    getUserPrompt,
    getProjectPrompt,
} from "../../prompts/base";
import { toOllamaMessages } from "../../utils/chat/ollamaChat";
import { readAccessTokenFromLocalStorage } from "../../services/api/authTokens";
import { Config } from "../../config";

const TOOL_STAGE_BY_NAME: Record<string, AssistantStage> = {
    planning_tool: "planning",
    qa_tool: "questioning",
};

const resolveToolStage = (toolName: string): AssistantStage => {
    return TOOL_STAGE_BY_NAME[toolName] || "tools_calling";
};

export function useChat() {
    const { userProfile: chatParamsProfile } = useChatParams();
    const { chatDriver, ollamaModel } = chatParamsProfile;
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
    const chatSessionIdRef = useRef<string | null>(null);
    const cancellationRequestedRef = useRef(false);
    const isSendInFlightRef = useRef(false);

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

    const sendMessage = (rawContent: string) => {
        void (async () => {
            if (isSendInFlightRef.current) {
                return;
            }

            messagesRef.current = chatsStore.messages;

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

                if (chatDriver !== "ollama") {
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

                const hasConnectedVectorStorage = Boolean(
                    activeProjectId && activeProject?.vecStorId,
                );

                const requestTools = hasConnectedVectorStorage
                    ? toolsStore.toolDefinitions
                    : toolsStore.getToolDefinitions([
                          "vector_store_search_tool",
                      ]);
                const enabledToolNames = requestTools.map(
                    (tool) => tool.function.name,
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
                                      "SCENARIO_POLICY: Execute the scenario strictly by its graph links and do not skip required transitions.",
                                      "SCENARIO_POLICY: If required data is missing, ask up to 3 short precise questions via qa_tool or ask one direct assistant question.",
                                      "SCENARIO_POLICY: Do not fabricate intermediate scenario state, external results, or user inputs.",
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
                                      "PROJECT_VECTOR_SEARCH_POLICY: In this project chat you must use vector_store_search_tool before the final answer whenever the task can depend on project documents, repository facts, requirements, architecture, or prior project decisions.",
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
                let stopChatEvents: (() => void) | null = null;
                let firstChunkTimeout: ReturnType<typeof setTimeout> | null =
                    null;
                const markFirstActivity = () => {
                    if (hasFirstChunk) {
                        return;
                    }

                    hasFirstChunk = true;
                    if (firstChunkTimeout) {
                        clearTimeout(firstChunkTimeout);
                        firstChunkTimeout = null;
                    }
                    setIsAwaitingFirstChunk(false);
                };

                try {
                    const sessionId = `chat_${crypto.randomUUID().replace(/-/g, "")}`;
                    const llmApi = window.appApi.llm;

                    chatSessionIdRef.current = sessionId;
                    chatRuntimeStore.startSession(sessionId);
                    let sessionError: Error | null = null;
                    let isTerminalEventReceived = false;
                    let resolveTerminalEvent: (() => void) | null = null;
                    const terminalEventPromise = new Promise<void>(
                        (resolve) => {
                            resolveTerminalEvent = resolve;
                        },
                    );

                    const settleTerminalEvent = () => {
                        if (isTerminalEventReceived) {
                            return;
                        }

                        isTerminalEventReceived = true;
                        resolveTerminalEvent?.();
                    };

                    const handleChatEvent = (event: ChatSessionEvent) => {
                        if (event.sessionId !== sessionId) {
                            return;
                        }

                        if (event.type === "thinking.delta") {
                            if (!event.chunkText) {
                                return;
                            }

                            setStreamStage("thinking");
                            markFirstActivity();
                            chunkQueueManager.enqueue(
                                "thinking",
                                event.chunkText,
                            );
                            return;
                        }

                        if (event.type === "content.delta") {
                            if (!event.chunkText) {
                                return;
                            }

                            setStreamStage("answering");
                            markFirstActivity();
                            chunkQueueManager.enqueue(
                                "answering",
                                event.chunkText,
                            );
                            return;
                        }

                        if (event.type === "tool.call") {
                            chunkQueueManager.flushImmediate();
                            const toolStage = resolveToolStage(event.toolName);
                            setStreamStage(toolStage);
                            markFirstActivity();
                            const messageId = createMessageId();
                            toolTraceMessageIds.set(event.callId, messageId);
                            const confirmationSpec =
                                toolsStore.getToolConfirmation(event.toolName);
                            const commandMeta =
                                event.toolName === "command_exec"
                                    ? getCommandRequestMeta(event.args)
                                    : null;

                            updateMessages((prev) => [
                                ...prev,
                                {
                                    id: messageId,
                                    author: "assistant",
                                    assistantStage: toolStage,
                                    answeringAt: userMessage.id,
                                    toolTrace: {
                                        callId: event.callId,
                                        toolName: event.toolName,
                                        args: event.args,
                                        result: null,
                                        ...(confirmationSpec
                                            ? {
                                                  status: "pending" as const,
                                                  confirmationTitle:
                                                      confirmationSpec.title,
                                                  confirmationPrompt:
                                                      confirmationSpec.prompt,
                                              }
                                            : event.toolName === "command_exec"
                                              ? {
                                                    status: "running" as const,
                                                }
                                              : {}),
                                        ...(event.toolName === "command_exec"
                                            ? {
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
                            return;
                        }

                        if (event.type === "tool.result") {
                            chunkQueueManager.flushImmediate();
                            const toolStage = resolveToolStage(event.toolName);
                            setStreamStage(toolStage);
                            const confirmationSpec =
                                toolsStore.getToolConfirmation(event.toolName);
                            const messageId = toolTraceMessageIds.get(
                                event.callId,
                            );
                            const inferredStatus = inferToolTraceStatus(
                                event.toolName,
                                event.result,
                            );

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
                                                callId: event.callId,
                                                ...(event.docId
                                                    ? {
                                                          docId: event.docId,
                                                      }
                                                    : {}),
                                                toolName: event.toolName,
                                                args: event.args,
                                                result: event.result,
                                                status: inferredStatus,
                                                ...(confirmationSpec?.title
                                                    ? {
                                                          confirmationTitle:
                                                              confirmationSpec.title,
                                                      }
                                                    : {}),
                                                ...(confirmationSpec?.prompt
                                                    ? {
                                                          confirmationPrompt:
                                                              confirmationSpec.prompt,
                                                      }
                                                    : {}),
                                                ...(event.toolName ===
                                                "command_exec"
                                                    ? getCommandRequestMeta(
                                                          event.args,
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
                                                  callId: event.callId,
                                                  ...(event.docId
                                                      ? {
                                                            docId: event.docId,
                                                        }
                                                      : {}),
                                                  toolName: event.toolName,
                                                  args: event.args,
                                                  result: event.result,
                                                  status: inferredStatus,
                                                  ...(event.toolName ===
                                                  "command_exec"
                                                      ? getCommandRequestMeta(
                                                            event.args,
                                                        )
                                                      : {}),
                                              },
                                              content: "",
                                          }
                                        : message,
                                );
                            });
                            return;
                        }

                        if (event.type === "usage") {
                            responseUsage = {
                                promptTokens: Math.max(0, event.promptTokens),
                                completionTokens: Math.max(
                                    0,
                                    event.completionTokens,
                                ),
                                totalTokens: Math.max(0, event.totalTokens),
                            };
                            return;
                        }

                        if (event.type === "done") {
                            setIsAwaitingFirstChunk(false);
                            chatRuntimeStore.updateStreamingState({
                                isAwaitingFirstChunk: false,
                            });
                            settleTerminalEvent();
                            return;
                        }

                        if (event.type === "error") {
                            sessionError = new Error(event.message);
                            settleTerminalEvent();
                        }
                    };

                    stopChatEvents = llmApi.onChatEvent(handleChatEvent);

                    firstChunkTimeout = setTimeout(() => {
                        if (hasFirstChunk || cancellationRequestedRef.current) {
                            return;
                        }

                        sessionError = new Error(
                            "Не удалось получить первый фрагмент ответа. Проверьте подключение к модели.",
                        );
                        void llmApi.cancelChatSession(sessionId);
                        settleTerminalEvent();
                    }, 45000);

                    const payload: RunChatSessionPayload = {
                        sessionId,
                        model: ollamaModel,
                        messages: toOllamaMessages(historyForRequest),
                        enabledToolNames,
                        agentMode: "default",
                        think: true,
                        ...(scenarioFormatHint
                            ? { format: scenarioFormatHint }
                            : {}),
                        maxToolCalls:
                            userProfile.maxToolCallsPerResponse > 0
                                ? userProfile.maxToolCallsPerResponse
                                : 1,
                        useAutoToolCallingConfirmation:
                            userProfile.useAutoToolCallingConfirmation,
                        runtimeContext: {
                            activeDialogId: currentDialog.id,
                            activeProjectId,
                            projectDirectory:
                                projectsStore.activeProject?.directoryPath ||
                                "",
                            projectVectorStorageId:
                                projectsStore.activeProject?.vecStorId || "",
                            currentDate: new Date().toISOString(),
                            zvsAccessToken: readAccessTokenFromLocalStorage(),
                            zvsBaseUrl: Config.ZVS_MAIN_BASE_URL,
                            telegramId: userProfile.telegramId,
                            telegramBotToken: userProfile.telegramBotToken,
                        },
                    };

                    await llmApi.runChatSession(payload);
                    settleTerminalEvent();
                    await terminalEventPromise;

                    if (sessionError) {
                        throw sessionError;
                    }

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
                    if (cancellationRequestedRef.current) {
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
                    if (firstChunkTimeout) {
                        clearTimeout(firstChunkTimeout);
                        firstChunkTimeout = null;
                    }
                    stopChatEvents?.();
                    chunkQueueManager.reset();
                    chatSessionIdRef.current = null;
                    chatRuntimeStore.clearSession();
                    cancellationRequestedRef.current = false;
                    setIsAwaitingFirstChunk(false);
                    setIsStreaming(false);
                    setActiveStage(null);
                    setActiveResponseToId(null);
                }
            } finally {
                isSendInFlightRef.current = false;
            }
        })();
    };

    const cancelGeneration = () => {
        const sessionId = chatSessionIdRef.current;

        if (!sessionId) {
            return;
        }

        cancellationRequestedRef.current = true;
        void window.appApi?.llm?.cancelChatSession(sessionId);
    };

    useEffect(() => {
        chatRuntimeStore.updateStreamingState({
            isStreaming,
            isAwaitingFirstChunk,
        });
    }, [isAwaitingFirstChunk, isStreaming]);

    return {
        messages: visibleMessages,
        sendMessage,
        cancelGeneration,
        isStreaming,
        isAwaitingFirstChunk,
        activeStage,
        activeResponseToId,
    };
}
