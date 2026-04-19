import { useCallback, useEffect, useRef, useState } from "react";
import { toJS } from "mobx";
import { resolveText } from "../utils/resolvers";
import { workspaceStore } from "../stores/workspaceStore";
import { profileStore } from "../stores/profileStore";
import { storageStore } from "../stores/storageStore";
import { getVecstoreSourcesInjectablePrompt } from "../prompts/injectable";
import { DialogUiMessage } from "../../electron/models";
import type {
    ChatImageAttachment,
    ChatRequestContentPart,
    ChatRequestMessage,
    VecstoreSearchResult,
} from "../../electron/models/chat";
import type { DialogContextMessage } from "../../electron/models/dialog";
import type { AskToolResult } from "../../electron/models/tool";
import type {
    AllowedChatProviders,
    AssistantMode,
} from "../../electron/models/user";
import type { QaToolState } from "../utils/tools/qaTool";
import { toolsStorage } from "../stores/toolsStorage";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { createId, createStageId } from "../utils/creators";
import { MsgToasts } from "../data/MsgToasts";

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

const toTextRequestContent = (text: string): ChatRequestContentPart[] => {
    return [
        {
            type: "text",
            text,
        },
    ];
};

const toBase64ImageData = (dataUrl: string) => {
    const commaIndex = dataUrl.indexOf(",");

    if (commaIndex < 0) {
        return dataUrl;
    }

    return dataUrl.slice(commaIndex + 1);
};

const toUserRequestContent = (
    content: string,
    attachments: ChatImageAttachment[],
): ChatRequestContentPart[] => {
    const nextContent: ChatRequestContentPart[] = [];

    if (content.trim().length > 0) {
        nextContent.push({
            type: "text",
            text: content,
        });
    }

    for (const attachment of attachments) {
        nextContent.push({
            type: "image",
            image: toBase64ImageData(attachment.dataUrl),
            mediaType: attachment.mimeType,
        });
    }

    return nextContent;
};

const toModelMessage = (message: DialogContextMessage): ChatRequestMessage => {
    if (message.role !== "user") {
        return {
            role: message.role,
            content: toTextRequestContent(message.content),
        };
    }

    const attachments = message.attachments ?? [];

    if (attachments.length === 0) {
        return {
            role: message.role,
            content: toTextRequestContent(message.content),
        };
    }

    return {
        role: message.role,
        content: toUserRequestContent(message.content, attachments),
    };
};

type StartGenerationOptions = {
    skipUserUiMessage?: boolean;
    contextOnlyUserMessage?: string;
    attachments?: ChatImageAttachment[];
    mode?: AssistantMode;
};

type SendMessageOptions = {
    attachments?: ChatImageAttachment[];
    mode?: AssistantMode;
};

const canUseToolsInMode = (mode: AssistantMode) => mode === "agent";

const DEFAULT_VECSTORE_MAX_RESULTS = 5;
const DEFAULT_VECSTORE_CONFIDENCE_PERCENTAGE = 80;

const normalizeVecstoreMaxResults = (value: number | undefined) => {
    if (!Number.isFinite(value)) {
        return DEFAULT_VECSTORE_MAX_RESULTS;
    }

    return Math.min(Math.max(Math.floor(value ?? 0), 1), 50);
};

const normalizeVecstoreConfidencePercentage = (value: number | undefined) => {
    if (!Number.isFinite(value)) {
        return DEFAULT_VECSTORE_CONFIDENCE_PERCENTAGE;
    }

    const threshold = value ?? DEFAULT_VECSTORE_CONFIDENCE_PERCENTAGE;
    const percentage = threshold <= 1 ? threshold * 100 : threshold;

    return Math.min(Math.max(percentage, 0), 100);
};

const getVecstoreSearchParams = () => {
    const generalData = profileStore.user?.generalData;

    return {
        maxResults: normalizeVecstoreMaxResults(
            generalData?.maxEmbeddedSources,
        ),
        confidencePercentage: normalizeVecstoreConfidencePercentage(
            generalData?.confidenceThreshold,
        ),
    };
};

const injectPromptIntoLastUserModelMessage = (
    messages: ChatRequestMessage[],
    injectablePrompt: string,
) => {
    const normalizedInjectablePrompt = injectablePrompt.trim();

    if (!normalizedInjectablePrompt) {
        return messages;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];

        if (message.role !== "user") {
            continue;
        }

        const nextContent = [...message.content];
        const textPartIndex = nextContent.findIndex(
            (part) => part.type === "text",
        );

        if (textPartIndex < 0) {
            nextContent.unshift({
                type: "text",
                text: normalizedInjectablePrompt,
            });
        } else {
            const textPart = nextContent[textPartIndex];

            if (textPart.type === "text") {
                nextContent[textPartIndex] = {
                    type: "text",
                    text: [textPart.text.trim(), normalizedInjectablePrompt]
                        .filter(Boolean)
                        .join("\n\n"),
                };
            }
        }

        const nextMessages = [...messages];
        nextMessages[index] = {
            ...message,
            content: nextContent,
        };

        return nextMessages;
    }

    return messages;
};

export const useChat = () => {
    const toast = useToasts();
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
            toast.danger(MsgToasts.PROFILE_WAS_NOT_LOADED_ERROR());
            return false;
        }

        const activeProvider = (currentUser.generalData.chatGenProvider ??
            "ollama") as AllowedChatProviders;
        const providerConfig =
            currentUser.secureData.chatGenProviders?.[activeProvider];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            toast.danger(MsgToasts.PROVIDER_NOT_CONFIGURED_ERROR());
            return false;
        }

        return true;
    }, [toast]);

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
        return workspaceStore.contextMessages.map(toModelMessage);
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
            const attachments = options?.attachments ?? [];
            const mode =
                options?.mode ??
                profileStore.user?.generalData.selectedAssistantMode;

            if (!normalizedPrompt && attachments.length === 0) {
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
                    attachments,
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
                let modelMessages = buildModelMessages();
                const activeDialogVecstoreId =
                    workspaceStore.activeDialogVecstoreId;
                const selectedDialogVecstore = activeDialogVecstoreId
                    ? (storageStore.vecstores.find(
                          (vecstore) => vecstore.id === activeDialogVecstoreId,
                      ) ?? null)
                    : null;
                let selectedVecstoreResults: VecstoreSearchResult[] = [];

                if (activeDialogVecstoreId && normalizedPrompt.length > 0) {
                    const vecstoreSearchParams = getVecstoreSearchParams();
                    const vecstoreResults = await window.chat.getVecstoreResult(
                        normalizedPrompt,
                        vecstoreSearchParams.maxResults,
                        vecstoreSearchParams.confidencePercentage,
                    );
                    selectedVecstoreResults = vecstoreResults.filter(
                        (result) =>
                            result.vecstoreId === activeDialogVecstoreId,
                    );
                }

                if (normalizedPrompt.length > 0) {
                    const injectablePrompt = getVecstoreSourcesInjectablePrompt(
                        selectedDialogVecstore?.name ?? null,
                        selectedVecstoreResults,
                    );

                    modelMessages = injectPromptIntoLastUserModelMessage(
                        modelMessages,
                        injectablePrompt,
                    );
                }

                updateMessages((current) => {
                    return current.map((message) =>
                        message.id === assistantMessage.id
                            ? {
                                  ...message,
                                  sources: selectedVecstoreResults,
                              }
                            : message,
                    );
                }, false);

                const enabledToolNames = canUseToolsInMode(mode ?? "chat")
                    ? toJS(
                          profileStore.user?.generalData.enabledPromptTools ??
                              [],
                      )
                    : [];

                window.chat.streamResponseGeneration({
                    requestId,
                    prompt:
                        skipUserUiMessage || normalizedPrompt.length === 0
                            ? undefined
                            : normalizedPrompt,
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
            updateMessages,
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

    const sendMessage = useCallback(
        async (options?: SendMessageOptions) => {
            if (isGenerating) {
                return false;
            }

            const prompt = input.trim();
            const attachments = options?.attachments ?? [];
            const mode =
                options?.mode ??
                profileStore.user?.generalData.selectedAssistantMode;

            if (!prompt && attachments.length === 0) {
                return false;
            }

            const isStarted = await startGeneration(prompt, {
                attachments,
                mode,
            });

            if (isStarted) {
                setInput("");
            }

            return isStarted;
        },
        [input, isGenerating, startGeneration],
    );

    const copyMessage = useCallback(
        async (content: string) => {
            await navigator.clipboard.writeText(content);
            toast.success(MsgToasts.COPY_SUCCESS());
        },
        [toast],
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
            const attachments = target.attachments ?? [];

            if (!prompt && attachments.length === 0) {
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

            await startGeneration(prompt, {
                attachments,
            });
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
