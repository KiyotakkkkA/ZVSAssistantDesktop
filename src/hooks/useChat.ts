import { useCallback, useEffect, useRef, useState } from "react";
import { useToasts } from "./useToasts";
import { resolveText } from "../utils/resolvers";
import { workspaceStore } from "../stores/workspaceStore";
import { DialogUiMessage } from "../../electron/models";

const DEFAULT_MODEL = "gpt-oss:120b";

const createId = (): `msg-${string}` =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatTime = () =>
    new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

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

    const buildModelMessages = useCallback((history: DialogUiMessage[]) => {
        return history
            .filter(
                (message) =>
                    message.role === "user" || message.role === "assistant",
            )
            .filter(
                (message) =>
                    message.status !== "streaming" &&
                    (message.role === "user" ||
                        message.content.trim().length > 0),
            )
            .map((message) => ({
                role: message.role,
                content: message.content,
            }));
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
                next[assistantIndex] = {
                    ...assistantMessage,
                    status,
                    content:
                        assistantMessage.content ||
                        fallback ||
                        assistantMessage.content,
                };

                return next;
            }, persist);
        },
        [updateMessages],
    );

    const startGeneration = useCallback(
        async (prompt: string) => {
            if (!activeDialogId) {
                return;
            }

            const requestId = createId();
            activeRequestIdRef.current = requestId;

            const userMessage: DialogUiMessage = {
                id: createId(),
                role: "user",
                content: prompt,
                timestamp: formatTime(),
                status: "done",
            };

            const assistantMessage: DialogUiMessage = {
                id: createId(),
                role: "assistant",
                answeringAt: userMessage.id,
                content: "",
                reasoning: "",
                timestamp: formatTime(),
                status: "streaming",
            };

            workspaceStore.addMessages(activeDialogId, [
                userMessage,
                assistantMessage,
            ]);
            const nextMessages = [...workspaceStore.messages];
            setMessages(nextMessages);
            setIsGenerating(true);

            try {
                const modelMessages = buildModelMessages(nextMessages);

                window.chat.streamResponseGeneration({
                    requestId,
                    prompt,
                    model: DEFAULT_MODEL,
                    messages: modelMessages,
                });
                return;
            } catch (error) {
                markAssistantAs(
                    "error",
                    error instanceof Error
                        ? error.message
                        : "Не удалось отправить запрос",
                );
                activeRequestIdRef.current = null;
                setIsGenerating(false);
            }
        },
        [activeDialogId, buildModelMessages, markAssistantAs],
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
    ]);

    const sendMessage = useCallback(async () => {
        if (isGenerating) {
            return;
        }

        const prompt = input.trim();

        if (!prompt) {
            return;
        }

        setInput("");
        await startGeneration(prompt);
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

            const target = messages.find(
                (message) =>
                    message.id === messageId && message.role === "user",
            );

            if (!target) {
                return;
            }

            const prompt = (nextContent ?? target.content).trim();

            if (!prompt) {
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
        [activeDialogId, isGenerating, messages, startGeneration],
    );

    const deleteMessage = useCallback(
        (messageId: string) => {
            updateMessages((current) => {
                const target = current.find(
                    (message) =>
                        message.id === messageId && message.role === "user",
                );

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
            const target = messages.find(
                (message) =>
                    message.id === messageId && message.role === "user",
            );

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
    };
};
