import { useCallback, useEffect, useRef, useState } from "react";
import { toJS } from "mobx";
import { resolveText } from "../utils/resolvers";
import { workspaceStore } from "../stores/workspaceStore";
import { profileStore } from "../stores/profileStore";
import { DialogUiMessage } from "../../electron/models";
import type { AskToolResult } from "../../electron/models/tool";
import type { AllowedChatProviders } from "../../electron/models/user";
import type { QaToolState } from "../utils/tools/qaTool";
import { toolsStorage } from "../stores/toolsStorage";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";

const createId = (): `msg-${string}` =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createStageId = (): `stg-${string}` =>
    `stg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const appendAssistantStageDelta = (
    message: DialogUiMessage,
    stageType: "reasoning" | "answer",
    chunk: string,
) => {
    const stages = message.stages ?? [];
    const lastStage = stages.at(-1);

    if (lastStage && lastStage.type === stageType) {
        return [
            ...stages.slice(0, -1),
            {
                ...lastStage,
                content: `${lastStage.content}${chunk}`,
            },
        ];
    }

    return [
        ...stages,
        {
            id: createStageId(),
            type: stageType,
            content: chunk,
        },
    ];
};

const formatTime = () =>
    new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

const findUserMessageById = (items: DialogUiMessage[], messageId: string) => {
    return items.find(
        (message) => message.id === messageId && message.role === "user",
    );
};

type StartGenerationOptions = {
    skipUserUiMessage?: boolean;
    contextOnlyUserMessage?: string;
};

export const useChat = () => {
    const toasts = useToasts();
    const [messages, setMessages] = useState<DialogUiMessage[]>(
        workspaceStore.messages,
    );
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(
        null,
    );
    const [editingValue, setEditingValue] = useState("");

    const activeRequestIdRef = useRef<string | null>(null);
    const activeDialogId = workspaceStore.activeDialogId;

    const ensureProviderConfigured = useCallback(() => {
        const currentUser = profileStore.user;

        if (!currentUser) {
            toasts.danger({
                title: "Профиль не найден",
                description: "Не удалось получить настройки провайдера.",
            });
            return false;
        }

        const activeProvider = (currentUser.generalData.chatGenProvider ??
            "ollama") as AllowedChatProviders;
        const providerConfig =
            currentUser.secureData.chatGenProviders?.[activeProvider];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            toasts.danger({
                title: "Провайдер не настроен",
                description:
                    "Заполните Base URL и модель в настройках провайдера.",
            });
            return false;
        }

        return true;
    }, [toasts]);

    const updateMessages = useCallback(
        (
            updater: (current: DialogUiMessage[]) => DialogUiMessage[],
            persist = true,
        ) => {
            setMessages((current) => {
                const next = updater(current);
                if (activeDialogId) {
                    workspaceStore.setDialogMessages(
                        activeDialogId,
                        next,
                        persist,
                    );
                }
                return next;
            });
        },
        [activeDialogId],
    );

    const buildModelMessages = useCallback(() => {
        return [...workspaceStore.contextMessages];
    }, []);

    const applyAssistantDelta = useCallback(
        (delta: unknown) => {
            const chunk = resolveText(delta);

            if (!chunk) {
                return;
            }

            updateMessages((current) => {
                const next = [...current];
                const assistantIndex = next
                    .map((message) => message.role)
                    .lastIndexOf("assistant");

                if (assistantIndex < 0) {
                    return current;
                }

                const assistantMessage = next[assistantIndex];
                next[assistantIndex] = {
                    ...assistantMessage,
                    content: assistantMessage.content + chunk,
                    stages: appendAssistantStageDelta(
                        assistantMessage,
                        "answer",
                        chunk,
                    ),
                };

                return next;
            }, false);
        },
        [updateMessages],
    );

    const applyAssistantReasoningDelta = useCallback(
        (delta: unknown) => {
            const chunk = resolveText(delta);

            if (!chunk) {
                return;
            }

            updateMessages((current) => {
                const next = [...current];
                const assistantIndex = next
                    .map((message) => message.role)
                    .lastIndexOf("assistant");

                if (assistantIndex < 0) {
                    return current;
                }

                const assistantMessage = next[assistantIndex];
                next[assistantIndex] = {
                    ...assistantMessage,
                    reasoning: `${assistantMessage.reasoning ?? ""}${chunk}`,
                    stages: appendAssistantStageDelta(
                        assistantMessage,
                        "reasoning",
                        chunk,
                    ),
                };

                return next;
            }, false);
        },
        [updateMessages],
    );

    const markAssistantAs = useCallback(
        (
            status: DialogUiMessage["status"],
            fallbackText?: unknown,
            persist = true,
        ) => {
            updateMessages((current) => {
                const next = [...current];
                const assistantIndex = next
                    .map((message) => message.role)
                    .lastIndexOf("assistant");

                if (assistantIndex < 0) {
                    return current;
                }

                const assistantMessage = next[assistantIndex];
                const fallback = resolveText(fallbackText);
                const hasFallback =
                    !assistantMessage.content && Boolean(fallback);
                next[assistantIndex] = {
                    ...assistantMessage,
                    status,
                    content:
                        assistantMessage.content ||
                        fallback ||
                        assistantMessage.content,
                    stages: hasFallback
                        ? appendAssistantStageDelta(
                              assistantMessage,
                              "answer",
                              fallback,
                          )
                        : assistantMessage.stages,
                };

                return next;
            }, persist);
        },
        [updateMessages],
    );

    const startGeneration = useCallback(
        async (prompt: string, options?: StartGenerationOptions) => {
            if (!activeDialogId) {
                return false;
            }

            const normalizedPrompt = prompt.trim();

            if (!normalizedPrompt) {
                return false;
            }

            if (!ensureProviderConfigured()) {
                return false;
            }

            const skipUserUiMessage = options?.skipUserUiMessage === true;
            const hiddenContextPrompt = options?.contextOnlyUserMessage?.trim();

            const requestId = createId();
            activeRequestIdRef.current = requestId;
            const userMessageId = createId();

            if (hiddenContextPrompt) {
                workspaceStore.addContextUserMessage(
                    activeDialogId,
                    hiddenContextPrompt,
                    true,
                );
            }

            const assistantMessage: DialogUiMessage = {
                id: createId(),
                role: "assistant",
                answeringAt: skipUserUiMessage ? undefined : userMessageId,
                content: "",
                reasoning: "",
                toolTraces: [],
                stages: [],
                timestamp: formatTime(),
                status: "streaming",
            };

            if (skipUserUiMessage) {
                workspaceStore.addMessages(activeDialogId, [assistantMessage]);
            } else {
                const userMessage: DialogUiMessage = {
                    id: userMessageId,
                    role: "user",
                    content: normalizedPrompt,
                    timestamp: formatTime(),
                    status: "done",
                };

                workspaceStore.addMessages(activeDialogId, [
                    userMessage,
                    assistantMessage,
                ]);
            }

            const nextMessages = [...workspaceStore.messages];
            setMessages(nextMessages);
            setIsGenerating(true);

            try {
                const modelMessages = buildModelMessages();
                const enabledToolNames = toJS(
                    profileStore.user?.generalData.enabledPromptTools ?? [],
                );

                window.chat.streamResponseGeneration({
                    requestId,
                    prompt: skipUserUiMessage ? undefined : normalizedPrompt,
                    messages: modelMessages,
                    dialogId: activeDialogId,
                    toolPackIds: ["systemTools"],
                    enabledToolNames,
                });
                return true;
            } catch (error) {
                markAssistantAs(
                    "error",
                    error instanceof Error
                        ? error.message
                        : "Не удалось отправить запрос",
                );
                activeRequestIdRef.current = null;
                setIsGenerating(false);
                return false;
            }
        },
        [
            activeDialogId,
            buildModelMessages,
            ensureProviderConfigured,
            markAssistantAs,
        ],
    );

    useEffect(() => {
        setMessages([...workspaceStore.messages]);
        setEditingMessageId(null);
        setEditingValue("");
    }, [activeDialogId]);

    useEffect(() => {
        const unsubscribe = window.chat.onStreamEvent(({ requestId, part }) => {
            if (
                !activeRequestIdRef.current ||
                activeRequestIdRef.current !== requestId
            ) {
                return;
            }

            if (part.type === "text-delta") {
                applyAssistantDelta(part.text);
                return;
            }

            if (part.type === "reasoning-delta") {
                applyAssistantReasoningDelta(part.text);
                return;
            }

            if (part.type === "error") {
                markAssistantAs(
                    "error",
                    part.error ?? "Ошибка генерации ответа",
                    true,
                );
                activeRequestIdRef.current = null;
                setIsGenerating(false);
                return;
            }

            if (part.type === "tool-call") {
                updateMessages(
                    (current) =>
                        toolsStorage.applyToolCall(current, {
                            toolCallId: part.toolCallId as string | undefined,
                            toolName: part.toolName as string | undefined,
                            input: part.input,
                            args: part.args,
                        }),
                    false,
                );
                return;
            }

            if (part.type === "tool-result") {
                updateMessages(
                    (current) =>
                        toolsStorage.applyToolResult(current, {
                            toolCallId: part.toolCallId as string | undefined,
                            toolName: part.toolName as string | undefined,
                            output: part.output,
                            result: part.result,
                            errorText: part.errorText as string | undefined,
                        }),
                    false,
                );
                return;
            }

            if (part.type === "finish") {
                markAssistantAs("done", undefined, false);
            }

            if (part.type === "usage") {
                if (activeDialogId) {
                    void workspaceStore.updateDialogState(
                        activeDialogId,
                        part.usage,
                    );
                }

                activeRequestIdRef.current = null;
                setIsGenerating(false);

                return;
            }
        });

        return unsubscribe;
    }, [
        activeDialogId,
        applyAssistantDelta,
        applyAssistantReasoningDelta,
        markAssistantAs,
        updateMessages,
    ]);

    const sendMessage = useCallback(async () => {
        if (isGenerating) {
            return;
        }

        const prompt = input.trim();

        if (!prompt) {
            return;
        }

        const isStarted = await startGeneration(prompt);

        if (isStarted) {
            setInput("");
        }
    }, [input, isGenerating, startGeneration]);

    const copyMessage = useCallback(
        async (content: string) => {
            try {
                await navigator.clipboard.writeText(content);
                toasts.success({
                    title: "Скопировано",
                    description: "Сообщение скопировано в буфер обмена.",
                });
            } catch {
                toasts.danger({
                    title: "Ошибка копирования",
                    description: "Не удалось скопировать сообщение.",
                });
            }
        },
        [toasts],
    );

    const refreshMessage = useCallback(
        async (messageId: string, nextContent?: string) => {
            if (isGenerating) {
                return;
            }

            const target = findUserMessageById(messages, messageId);

            if (!target) {
                return;
            }

            const prompt = (nextContent ?? target.content).trim();

            if (!prompt) {
                return;
            }

            if (!ensureProviderConfigured()) {
                return;
            }

            if (!activeDialogId) {
                return;
            }

            workspaceStore.truncateMessagesFromId(activeDialogId, messageId);
            const truncated = [...workspaceStore.messages];
            setMessages(truncated);

            await startGeneration(prompt);
        },
        [
            activeDialogId,
            ensureProviderConfigured,
            isGenerating,
            messages,
            startGeneration,
        ],
    );

    const deleteMessage = useCallback(
        (messageId: string) => {
            updateMessages((current) => {
                const target = findUserMessageById(current, messageId);

                if (!target) {
                    return current;
                }

                return current.filter(
                    (message) =>
                        message.id !== messageId &&
                        message.answeringAt !== messageId,
                );
            });
        },
        [updateMessages],
    );

    const startEditMessage = useCallback(
        (messageId: string) => {
            const target = findUserMessageById(messages, messageId);

            if (!target) {
                return;
            }

            setEditingMessageId(messageId);
            setEditingValue(target.content);
        },
        [messages],
    );

    const cancelEditMessage = useCallback(() => {
        setEditingMessageId(null);
        setEditingValue("");
    }, []);

    const confirmEditMessage = useCallback(async () => {
        if (!editingMessageId) {
            return;
        }

        await refreshMessage(editingMessageId, editingValue);
        setEditingMessageId(null);
        setEditingValue("");
    }, [editingMessageId, editingValue, refreshMessage]);

    const clearChat = useCallback(() => {
        activeRequestIdRef.current = null;
        setIsGenerating(false);
        if (activeDialogId) {
            workspaceStore.setDialogMessages(activeDialogId, []);
        }
        setMessages([...workspaceStore.messages]);
    }, [activeDialogId]);

    const selectAskQuestion = useCallback(
        (messageId: string, toolCallId: string, questionIndex: number) => {
            updateMessages(
                (current) =>
                    toolsStorage.setAskActiveQuestion(
                        current,
                        messageId,
                        toolCallId,
                        questionIndex,
                    ),
                true,
            );
        },
        [updateMessages],
    );

    const saveAskAnswer = useCallback(
        (
            messageId: string,
            toolCallId: string,
            questionIndex: number,
            answer: string,
        ) => {
            updateMessages(
                (current) =>
                    toolsStorage.saveAskAnswer(
                        current,
                        messageId,
                        toolCallId,
                        questionIndex,
                        answer,
                    ),
                true,
            );
        },
        [updateMessages],
    );

    const sendAskAnswers = useCallback(
        async (messageId: string, toolCallId: string, qaState: QaToolState) => {
            if (isGenerating) {
                return;
            }

            if (!ensureProviderConfigured()) {
                return;
            }

            const payload: AskToolResult = {
                questions: qaState.questions,
                activeQuestionIndex: qaState.activeQuestionIndex,
                answered: true,
            };

            updateMessages(
                (current) =>
                    toolsStorage.markAskAnswered(
                        current,
                        messageId,
                        toolCallId,
                    ),
                true,
            );

            const prompt = toolsStorage.buildAskAnswersPrompt(payload);
            await startGeneration(prompt, {
                skipUserUiMessage: true,
                contextOnlyUserMessage: prompt,
            });
        },
        [
            ensureProviderConfigured,
            isGenerating,
            startGeneration,
            updateMessages,
        ],
    );

    return {
        messages,
        input,
        isGenerating,
        editingMessageId,
        editingValue,
        setInput,
        setEditingValue,
        sendMessage,
        copyMessage,
        refreshMessage,
        deleteMessage,
        startEditMessage,
        cancelEditMessage,
        confirmEditMessage,
        clearChat,
        selectAskQuestion,
        saveAskAnswer,
        sendAskAnswers,
    };
};
