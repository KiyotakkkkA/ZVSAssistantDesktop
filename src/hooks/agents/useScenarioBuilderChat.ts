import { useMemo, useRef, useState } from "react";
import { useChatParams } from "../useChatParams";
import { useUserProfile } from "../useUserProfile";
import { useScenario } from "./useScenario";
import type { AssistantStage, ChatMessage } from "../../types/Chat";
import type {
    ChatSessionEvent,
    RunChatSessionPayload,
} from "../../types/ElectronApi";
import { toOllamaMessages } from "../../utils/chat/ollamaChat";
import { getScenarioBuilderPrompt } from "../../prompts/scenarioBuilder";
import { readAccessTokenFromLocalStorage } from "../../services/api/authTokens";
import { Config } from "../../config";
import { inferToolTraceStatus } from "../../utils/chat/toolExecution";
import {
    getCommandRequestMeta,
    getTimeStamp,
} from "../../utils/chat/chatStream";
import { toolsStore } from "../../stores/toolsStore";
import { scenarioStore } from "../../stores/scenarioStore";

const BUILDER_TOOL_NAMES = [
    "qa_tool",
    "planning_tool",
    "scenario_builder_tool",
    "get_tools_calling",
];

const TOOL_STAGE_BY_NAME: Record<string, AssistantStage> = {
    planning_tool: "planning",
    qa_tool: "questioning",
};

const resolveToolStage = (toolName: string): AssistantStage => {
    return TOOL_STAGE_BY_NAME[toolName] || "tools_calling";
};

const mergeStreamChunkText = (current: string, incoming: string): string => {
    if (!incoming) {
        return current;
    }

    if (!current) {
        return incoming;
    }

    // Some providers emit cumulative text instead of strict deltas.
    if (incoming.startsWith(current)) {
        return incoming;
    }

    if (current.endsWith(incoming)) {
        return current;
    }

    const maxOverlap = Math.min(current.length, incoming.length);
    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
        if (current.slice(-overlap) === incoming.slice(0, overlap)) {
            return `${current}${incoming.slice(overlap)}`;
        }
    }

    return `${current}${incoming}`;
};

const createMessage = (
    author: "system" | "user" | "assistant",
    content: string,
    extra: Partial<ChatMessage> = {},
): ChatMessage => ({
    id: `msg_${crypto.randomUUID().replace(/-/g, "")}`,
    author,
    content,
    timestamp: getTimeStamp(),
    ...extra,
});

export function useScenarioBuilderChat() {
    const { userProfile: chatParamsProfile } = useChatParams();
    const { ollamaModel } = chatParamsProfile;
    const { userProfile } = useUserProfile();
    const { activeScenario } = useScenario();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isAwaitingFirstChunk, setIsAwaitingFirstChunk] = useState(false);
    const [activeStage, setActiveStage] = useState<AssistantStage | null>(null);
    const [activeResponseToId, setActiveResponseToId] = useState<string | null>(
        null,
    );

    const inFlightRef = useRef(false);
    const chatSessionIdRef = useRef<string | null>(null);

    const visibleMessages = useMemo(
        () => messages.filter((message) => message.author !== "system"),
        [messages],
    );

    const sendMessage = (rawContent: string) => {
        void (async () => {
            if (inFlightRef.current || isStreaming) {
                return;
            }

            const llmApi = window.appApi?.llm;
            if (!llmApi) {
                return;
            }

            const content = rawContent.trim();
            if (!content) {
                return;
            }

            const sessionId = `scenario_builder_${crypto
                .randomUUID()
                .replace(/-/g, "")}`;

            const systemMessage = createMessage(
                "system",
                getScenarioBuilderPrompt(userProfile.assistantName),
            );
            const userMessage = createMessage("user", content);
            const toolTraceMessageIds = new Map<string, string>();

            const previous = [...messages];
            const historyForRequest = [systemMessage, ...previous, userMessage];

            setMessages((prevState) => [...prevState, userMessage]);

            inFlightRef.current = true;
            setIsStreaming(true);
            setIsAwaitingFirstChunk(true);
            setActiveResponseToId(userMessage.id);
            setActiveStage("thinking");

            let sessionError: Error | null = null;
            let hasFirstChunk = false;
            let firstChunkTimeout: ReturnType<typeof setTimeout> | null = null;

            const appendOrUpdateStageMessage = (
                stage: AssistantStage,
                chunkText: string,
            ) => {
                setMessages((prevState) => {
                    const updated = [...prevState];
                    const lastMessage = updated[updated.length - 1];

                    if (
                        lastMessage &&
                        lastMessage.author === "assistant" &&
                        !lastMessage.toolTrace &&
                        lastMessage.answeringAt === userMessage.id &&
                        lastMessage.assistantStage === stage
                    ) {
                        lastMessage.content = mergeStreamChunkText(
                            lastMessage.content,
                            chunkText,
                        );
                        return updated;
                    }

                    updated.push(
                        createMessage("assistant", chunkText, {
                            assistantStage: stage,
                            answeringAt: userMessage.id,
                        }),
                    );

                    return updated;
                });
            };

            const stop = llmApi.onChatEvent((event: ChatSessionEvent) => {
                if (event.sessionId !== sessionId) {
                    return;
                }

                if (event.type === "thinking.delta") {
                    if (!event.chunkText) {
                        return;
                    }

                    setActiveStage("thinking");
                    hasFirstChunk = true;
                    setIsAwaitingFirstChunk(false);
                    appendOrUpdateStageMessage("thinking", event.chunkText);
                    return;
                }

                if (event.type === "content.delta") {
                    if (!event.chunkText) {
                        return;
                    }

                    hasFirstChunk = true;
                    setIsAwaitingFirstChunk(false);
                    setActiveStage("answering");
                    appendOrUpdateStageMessage("answering", event.chunkText);
                    return;
                }

                if (event.type === "tool.call") {
                    hasFirstChunk = true;
                    setIsAwaitingFirstChunk(false);
                    const toolStage = resolveToolStage(event.toolName);
                    setActiveStage(toolStage);
                    const messageId = createMessage("assistant", "", {
                        assistantStage: toolStage,
                        answeringAt: userMessage.id,
                    }).id;
                    toolTraceMessageIds.set(event.callId, messageId);
                    const confirmationSpec = toolsStore.getToolConfirmation(
                        event.toolName,
                    );
                    const commandMeta =
                        event.toolName === "command_exec"
                            ? getCommandRequestMeta(event.args)
                            : null;

                    setMessages((prevState) => [
                        ...prevState,
                        {
                            id: messageId,
                            author: "assistant",
                            assistantStage: toolStage,
                            answeringAt: userMessage.id,
                            content: "",
                            timestamp: getTimeStamp(),
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
                                    : {}),
                                ...(event.toolName === "command_exec"
                                    ? {
                                          command: commandMeta?.command,
                                          cwd: commandMeta?.cwd,
                                          isAdmin: commandMeta?.isAdmin,
                                      }
                                    : {}),
                            },
                        },
                    ]);
                    return;
                }

                if (event.type === "tool.result") {
                    const toolStage = resolveToolStage(event.toolName);
                    setActiveStage(toolStage);

                    if (
                        event.toolName === "scenario_builder_tool" &&
                        event.result &&
                        typeof event.result === "object"
                    ) {
                        const resultObject = event.result as Record<
                            string,
                            unknown
                        >;
                        const isOk = resultObject.ok === true;
                        const action =
                            typeof resultObject.action === "string"
                                ? resultObject.action
                                : "";
                        const scenarioId =
                            typeof resultObject.scenarioId === "string"
                                ? resultObject.scenarioId
                                : "";

                        if (isOk && action !== "get_state" && scenarioId) {
                            void scenarioStore.loadScenario(scenarioId);
                        }
                    }

                    const messageId = toolTraceMessageIds.get(event.callId);
                    const inferredStatus = inferToolTraceStatus(
                        event.toolName,
                        event.result,
                    );

                    setMessages((prevState) => {
                        if (!messageId) {
                            return [
                                ...prevState,
                                {
                                    id: createMessage("assistant", "").id,
                                    author: "assistant",
                                    content: "",
                                    timestamp: getTimeStamp(),
                                    assistantStage: toolStage,
                                    answeringAt: userMessage.id,
                                    toolTrace: {
                                        callId: event.callId,
                                        ...(event.docId
                                            ? { docId: event.docId }
                                            : {}),
                                        toolName: event.toolName,
                                        args: event.args,
                                        result: event.result,
                                        status: inferredStatus,
                                        ...(event.toolName === "command_exec"
                                            ? getCommandRequestMeta(event.args)
                                            : {}),
                                    },
                                },
                            ];
                        }

                        return prevState.map((message) =>
                            message.id === messageId
                                ? {
                                      ...message,
                                      assistantStage: toolStage,
                                      toolTrace: {
                                          callId: event.callId,
                                          ...(event.docId
                                              ? { docId: event.docId }
                                              : {}),
                                          toolName: event.toolName,
                                          args: event.args,
                                          result: event.result,
                                          status: inferredStatus,
                                          ...(event.toolName === "command_exec"
                                              ? getCommandRequestMeta(
                                                    event.args,
                                                )
                                              : {}),
                                      },
                                  }
                                : message,
                        );
                    });
                    return;
                }

                if (event.type === "error") {
                    sessionError = new Error(event.message);
                    setIsAwaitingFirstChunk(false);
                    setActiveStage("answering");
                    return;
                }

                if (event.type === "done") {
                    setIsAwaitingFirstChunk(false);
                    setActiveStage(null);
                }
            });

            try {
                firstChunkTimeout = setTimeout(() => {
                    if (hasFirstChunk) {
                        return;
                    }

                    sessionError = new Error(
                        "Не удалось получить первый фрагмент ответа от модели.",
                    );
                    void llmApi.cancelChatSession(sessionId);
                }, 45000);

                const payload: RunChatSessionPayload = {
                    sessionId,
                    model: ollamaModel,
                    agentMode: "scenario_builder",
                    messages: toOllamaMessages(historyForRequest),
                    enabledToolNames: BUILDER_TOOL_NAMES,
                    think: true,
                    maxToolCalls:
                        userProfile.maxToolCallsPerResponse > 0
                            ? userProfile.maxToolCallsPerResponse
                            : 8,
                    useAutoToolCallingConfirmation:
                        userProfile.useAutoToolCallingConfirmation,
                    runtimeContext: {
                        activeDialogId: activeScenario?.id || sessionId,
                        activeProjectId: "",
                        projectDirectory: "",
                        projectVectorStorageId: "",
                        currentDate: new Date().toISOString(),
                        zvsAccessToken: readAccessTokenFromLocalStorage(),
                        zvsBaseUrl: Config.ZVS_MAIN_BASE_URL,
                        telegramId: userProfile.telegramId,
                        telegramBotToken: userProfile.telegramBotToken,
                    },
                };

                await llmApi.runChatSession(payload);

                if (sessionError) {
                    throw sessionError;
                }
            } catch (error) {
                const errorText =
                    error instanceof Error
                        ? error.message
                        : "Ошибка запуска mini-чата билдера";
                setMessages((prevState) => [
                    ...prevState,
                    createMessage("assistant", `Ошибка: ${errorText}`, {
                        assistantStage: "answering",
                        answeringAt: userMessage.id,
                    }),
                ]);
            } finally {
                if (firstChunkTimeout) {
                    clearTimeout(firstChunkTimeout);
                }
                stop();
                chatSessionIdRef.current = null;
                inFlightRef.current = false;
                setIsStreaming(false);
                setIsAwaitingFirstChunk(false);
                setActiveStage(null);
                setActiveResponseToId(null);
            }
        })();
    };

    const clearChat = () => {
        if (isStreaming) {
            return;
        }
        setMessages([]);
    };

    const resolveCommandApproval = (
        callId: string,
        accepted: boolean,
        nextStatus: "running" | "cancelled",
    ) => {
        setMessages((prevState) =>
            prevState.map((message) =>
                message.toolTrace?.callId === callId
                    ? {
                          ...message,
                          toolTrace: {
                              ...message.toolTrace,
                              status: nextStatus,
                          },
                      }
                    : message,
            ),
        );

        void window.appApi?.llm?.resolveCommandApproval({
            callId,
            accepted,
        });
    };

    const approveCommandExec = (callId: string) => {
        resolveCommandApproval(callId, true, "running");
    };

    const rejectCommandExec = (callId: string) => {
        resolveCommandApproval(callId, false, "cancelled");
    };

    const interruptCommandExec = (callId: string) => {
        void window.appApi?.llm?.interruptCommandExec(callId);
    };

    return {
        messages: visibleMessages,
        isStreaming,
        isAwaitingFirstChunk,
        activeStage,
        activeResponseToId,
        sendMessage,
        clearChat,
        approveCommandExec,
        rejectCommandExec,
        interruptCommandExec,
    };
}
