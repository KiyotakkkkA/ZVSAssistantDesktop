import { useCallback, useState } from "react";
import { chatsStore } from "../../stores/chatsStore";
import { useToasts } from "../useToasts";
import type { ChatDialog, QaToolState, ToolTrace } from "../../types/Chat";
import {
    buildQaToolSubmission,
    normalizeQaToolState,
} from "../../utils/chat/qaTool";

type UseMessagesParams = {
    sendMessage: (content: string) => void;
};

const isScenarioLaunchMessage = (content: string, author: string) =>
    author === "system" && content.startsWith("SCENARIO_LAUNCH:");

const resolveScenarioPairContext = (
    messages: { id: string; author: string; content: string }[],
    targetMessageId: string,
) => {
    const targetIndex = messages.findIndex(
        (message) => message.id === targetMessageId,
    );

    if (targetIndex === -1) {
        return {
            targetIndex: -1,
            targetMessage: null,
            previousMessage: null,
        };
    }

    return {
        targetIndex,
        targetMessage: messages[targetIndex] ?? null,
        previousMessage: messages[targetIndex - 1] ?? null,
    };
};

const resolveTruncateIndex = (
    messages: { id: string; author: string; content: string }[],
    targetMessageId: string,
) => {
    const { targetIndex, targetMessage, previousMessage } =
        resolveScenarioPairContext(messages, targetMessageId);

    if (targetIndex === -1) {
        return -1;
    }

    return targetMessage?.author === "user" &&
        previousMessage &&
        isScenarioLaunchMessage(previousMessage.content, previousMessage.author)
        ? targetIndex - 1
        : targetIndex;
};

const resolveDeletedIds = (
    messages: { id: string; author: string; content: string }[],
    targetMessageId: string,
) => {
    const deletedIds = new Set<string>([targetMessageId]);
    const { targetMessage, previousMessage } = resolveScenarioPairContext(
        messages,
        targetMessageId,
    );

    if (
        targetMessage?.author === "user" &&
        previousMessage &&
        isScenarioLaunchMessage(previousMessage.content, previousMessage.author)
    ) {
        deletedIds.add(previousMessage.id);
    }

    let hasNewItems = true;

    while (hasNewItems) {
        hasNewItems = false;

        for (const message of messages) {
            if (
                typeof (message as { answeringAt?: string }).answeringAt !==
                "string"
            ) {
                continue;
            }

            const parentId = (message as { answeringAt?: string }).answeringAt;

            if (!parentId || !deletedIds.has(parentId)) {
                continue;
            }

            if (!deletedIds.has(message.id)) {
                deletedIds.add(message.id);
                hasNewItems = true;
            }
        }
    }

    return deletedIds;
};

export const useMessages = ({ sendMessage }: UseMessagesParams) => {
    const toasts = useToasts();

    const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(
        null,
    );
    const [editingValue, setEditingValue] = useState("");

    const startEdit = useCallback((messageId: string, content: string) => {
        setEditingMessageId(messageId);
        setEditingValue(content);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingMessageId(null);
        setEditingValue("");
    }, []);

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

    const requestDeleteMessage = useCallback((messageId: string) => {
        setDeleteMessageId(messageId);
    }, []);

    const cancelDeleteMessage = useCallback(() => {
        setDeleteMessageId(null);
    }, []);

    const setToolTraceStatus = useCallback(
        (
            messageId: string,
            status: "accepted" | "running" | "cancelled" | "answered",
        ) => {
            const dialog = chatsStore.activeDialog;
            if (!dialog) return;

            chatsStore.replaceByDialog({
                ...dialog,
                messages: dialog.messages.map((message) =>
                    message.id === messageId && message.toolTrace
                        ? {
                              ...message,
                              toolTrace: { ...message.toolTrace, status },
                          }
                        : message,
                ),
                updatedAt: new Date().toISOString(),
            });
        },
        [],
    );

    const updateToolTrace = useCallback(
        (messageId: string, updater: (toolTrace: ToolTrace) => ToolTrace) => {
            const dialog = chatsStore.activeDialog;

            if (!dialog) {
                return;
            }

            chatsStore.replaceByDialog({
                ...dialog,
                messages: dialog.messages.map((message) =>
                    message.id === messageId && message.toolTrace
                        ? {
                              ...message,
                              toolTrace: updater(message.toolTrace),
                          }
                        : message,
                ),
                updatedAt: new Date().toISOString(),
            });
        },
        [],
    );

    const setQaActiveQuestion = useCallback(
        (messageId: string, questionIndex: number) => {
            updateToolTrace(messageId, (toolTrace) => {
                const qaState = normalizeQaToolState(toolTrace);

                return {
                    ...toolTrace,
                    qaState: {
                        ...qaState,
                        activeQuestionIndex: questionIndex,
                    },
                };
            });
        },
        [updateToolTrace],
    );

    const saveQaAnswer = useCallback(
        (messageId: string, questionIndex: number, answer: string) => {
            const nextAnswer = answer.trim();

            updateToolTrace(messageId, (toolTrace) => {
                const qaState = normalizeQaToolState(toolTrace);
                const questions = qaState.questions.map((question, index) =>
                    index === questionIndex
                        ? {
                              ...question,
                              answer: nextAnswer,
                          }
                        : question,
                );

                return {
                    ...toolTrace,
                    qaState: {
                        activeQuestionIndex: questionIndex,
                        questions,
                    },
                };
            });
        },
        [updateToolTrace],
    );

    const truncateDialogFromMessage = useCallback(
        async (dialog: ChatDialog, messageId: string) => {
            const truncateApi =
                window.appApi?.dialogs.truncateDialogFromMessage;

            if (truncateApi) {
                const updatedDialog = await truncateApi(dialog.id, messageId);
                chatsStore.replaceByDialog(updatedDialog);
                return;
            }

            const truncateIndex = resolveTruncateIndex(
                dialog.messages,
                messageId,
            );

            if (truncateIndex === -1) {
                return;
            }

            chatsStore.replaceByDialog({
                ...dialog,
                messages: dialog.messages.slice(0, truncateIndex),
                updatedAt: new Date().toISOString(),
            });
        },
        [],
    );

    const deleteDialogMessage = useCallback(
        async (dialog: ChatDialog, messageId: string) => {
            const deleteApi = window.appApi?.dialogs.deleteMessageFromDialog;

            if (deleteApi) {
                const updatedDialog = await deleteApi(dialog.id, messageId);
                chatsStore.replaceByDialog(updatedDialog);
                return;
            }

            const deletedIds = resolveDeletedIds(dialog.messages, messageId);

            chatsStore.replaceByDialog({
                ...dialog,
                messages: dialog.messages.filter(
                    (message) =>
                        !deletedIds.has(message.id) &&
                        !(
                            typeof message.answeringAt === "string" &&
                            deletedIds.has(message.answeringAt)
                        ),
                ),
                updatedAt: new Date().toISOString(),
            });
        },
        [],
    );

    const sendQaAnswer = useCallback(
        (qaMessageId: string, qaState?: QaToolState) => {
            const dialog = chatsStore.activeDialog;

            if (!dialog) {
                return;
            }

            const message = dialog.messages.find(
                (item) => item.id === qaMessageId,
            );
            const resolvedQaState =
                qaState ?? normalizeQaToolState(message?.toolTrace);
            const submission = buildQaToolSubmission(resolvedQaState);

            if (!submission.trim()) {
                return;
            }

            setToolTraceStatus(qaMessageId, "answered");
            sendMessage(`__qa_hidden__${submission}`);
        },
        [setToolTraceStatus, sendMessage],
    );

    const truncateAndResend = useCallback(
        async (messageId: string, content: string) => {
            const dialog = chatsStore.activeDialog;
            const trimmedContent = content.trim();

            if (!dialog || !trimmedContent) {
                return;
            }

            await truncateDialogFromMessage(dialog, messageId);

            cancelEdit();
            sendMessage(trimmedContent);
        },
        [cancelEdit, sendMessage, truncateDialogFromMessage],
    );

    const submitEdit = useCallback(async () => {
        if (!editingMessageId) {
            return;
        }

        const trimmedContent = editingValue.trim();

        if (!trimmedContent) {
            toasts.warning({
                title: "Пустое сообщение",
                description: "Введите текст перед отправкой.",
            });
            return;
        }

        await truncateAndResend(editingMessageId, trimmedContent);
    }, [editingMessageId, editingValue, toasts, truncateAndResend]);

    const retryMessage = useCallback(
        async (messageId: string, content: string) => {
            await truncateAndResend(messageId, content);
        },
        [truncateAndResend],
    );

    const confirmDeleteMessage = useCallback(async () => {
        const dialog = chatsStore.activeDialog;

        if (!dialog || !deleteMessageId) {
            return;
        }

        await deleteDialogMessage(dialog, deleteMessageId);

        toasts.success({
            title: "Сообщение удалено",
            description: "Сообщение удалено из текущего диалога.",
        });

        setDeleteMessageId(null);
    }, [deleteDialogMessage, deleteMessageId, toasts]);

    const approveCommandExec = useCallback(
        (messageId: string) => {
            setToolTraceStatus(messageId, "running");
            const dialog = chatsStore.activeDialog;
            const message = dialog?.messages.find(
                (item) => item.id === messageId,
            );
            const callId = message?.toolTrace?.callId;

            if (!callId) {
                return;
            }

            void window.appApi?.llm?.resolveCommandApproval({
                callId,
                accepted: true,
            });
        },
        [setToolTraceStatus],
    );

    const interruptCommandExec = useCallback((messageId: string) => {
        const dialog = chatsStore.activeDialog;
        const message = dialog?.messages.find((item) => item.id === messageId);
        const callId = message?.toolTrace?.callId;

        if (!callId) {
            return;
        }

        void window.appApi?.llm?.interruptCommandExec(callId);
    }, []);

    const rejectCommandExec = useCallback(
        (messageId: string) => {
            setToolTraceStatus(messageId, "cancelled");
            const dialog = chatsStore.activeDialog;
            const message = dialog?.messages.find(
                (item) => item.id === messageId,
            );
            const callId = message?.toolTrace?.callId;

            if (!callId) {
                return;
            }

            void window.appApi?.llm?.resolveCommandApproval({
                callId,
                accepted: false,
            });
        },
        [setToolTraceStatus],
    );

    return {
        editingMessageId,
        editingValue,
        setEditingValue,
        startEdit,
        cancelEdit,
        submitEdit,
        retryMessage,
        copyMessage,
        deleteMessageId,
        requestDeleteMessage,
        cancelDeleteMessage,
        confirmDeleteMessage,
        approveCommandExec,
        rejectCommandExec,
        interruptCommandExec,
        saveQaAnswer,
        setQaActiveQuestion,
        sendQaAnswer,
    };
};
