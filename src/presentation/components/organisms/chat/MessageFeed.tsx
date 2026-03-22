import { useEffect, useRef } from "react";
import { ChatUserBubbleCard } from "../../molecules/chat/cards";
import { AssistantResponse } from "./AssistantResponse";
import { DialogUiMessage } from "../../../../../electron/models";
import type { QaToolState } from "../../../../utils/chat/qaTool";

type FeedSnapshot = {
    length: number;
    lastId: string | null;
    lastContentLength: number;
    lastReasoningLength: number;
    lastStagesLength: number;
};

type MessageFeedProps = {
    messages: DialogUiMessage[];
    editingMessageId: string | null;
    editingValue: string;
    onEditValueChange: (value: string) => void;
    onStartEdit: (messageId: string) => void;
    onCancelEdit: () => void;
    onConfirmEdit: () => void;
    onCopyMessage: (content: string) => void;
    onRefreshMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    onSelectAskQuestion: (
        messageId: string,
        toolCallId: string,
        questionIndex: number,
    ) => void;
    onSaveAskAnswer: (
        messageId: string,
        toolCallId: string,
        questionIndex: number,
        answer: string,
    ) => void;
    onSendAskAnswers: (
        messageId: string,
        toolCallId: string,
        qaState: QaToolState,
    ) => void;
};

export const MessageFeed = ({
    messages,
    editingMessageId,
    editingValue,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onConfirmEdit,
    onCopyMessage,
    onRefreshMessage,
    onDeleteMessage,
    onSelectAskQuestion,
    onSaveAskAnswer,
    onSendAskAnswers,
}: MessageFeedProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const snapshotRef = useRef<FeedSnapshot | null>(null);

    useEffect(() => {
        if (!scrollRef.current) {
            return;
        }

        const lastMessage = messages.at(-1);
        const nextSnapshot: FeedSnapshot = {
            length: messages.length,
            lastId: lastMessage?.id ?? null,
            lastContentLength: lastMessage?.content.length ?? 0,
            lastReasoningLength: lastMessage?.reasoning?.length ?? 0,
            lastStagesLength: lastMessage?.stages?.length ?? 0,
        };

        const previousSnapshot = snapshotRef.current;

        if (!previousSnapshot) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            snapshotRef.current = nextSnapshot;
            return;
        }

        const hasNewMessage = nextSnapshot.length > previousSnapshot.length;
        const switchedLastMessage =
            nextSnapshot.lastId !== previousSnapshot.lastId;
        const grewLastMessageText =
            nextSnapshot.lastId === previousSnapshot.lastId &&
            (nextSnapshot.lastContentLength >
                previousSnapshot.lastContentLength ||
                nextSnapshot.lastReasoningLength >
                    previousSnapshot.lastReasoningLength ||
                nextSnapshot.lastStagesLength >
                    previousSnapshot.lastStagesLength);

        if (hasNewMessage || switchedLastMessage || grewLastMessageText) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        snapshotRef.current = nextSnapshot;
    }, [messages]);

    return (
        <section
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl bg-main-900/55 p-2 ring-main-300/15 animate-page-fade-in"
        >
            <div className="flex flex-col gap-4">
                {messages.length === 0 ? (
                    <p className="text-sm text-main-400">
                        Здесь будут отображаться сообщения чата
                    </p>
                ) : null}

                {messages.map((message, index) => {
                    if (message.role === "user") {
                        return (
                            <div
                                key={message.id}
                                className="animate-message-pop-in self-end"
                                style={{
                                    animationDelay: `${Math.min(index * 28, 220)}ms`,
                                }}
                            >
                                <ChatUserBubbleCard
                                    content={message.content}
                                    timestamp={message.timestamp}
                                    isEditing={editingMessageId === message.id}
                                    editValue={editingValue}
                                    onEditValueChange={onEditValueChange}
                                    onEditCancel={onCancelEdit}
                                    onEditConfirm={onConfirmEdit}
                                    msgCopy={() => {
                                        void onCopyMessage(message.content);
                                    }}
                                    msgRetry={() => {
                                        void onRefreshMessage(message.id);
                                    }}
                                    msgEdit={() => {
                                        onStartEdit(message.id);
                                    }}
                                    msgDelete={() => {
                                        onDeleteMessage(message.id);
                                    }}
                                />
                            </div>
                        );
                    }

                    const isStreaming = message.status === "streaming";
                    const isError = message.status === "error";

                    return (
                        <div
                            key={message.id}
                            className="animate-message-pop-in"
                            style={{
                                animationDelay: `${Math.min(index * 28, 220)}ms`,
                            }}
                        >
                            <AssistantResponse
                                messageId={message.id}
                                content={message.content}
                                reasoning={message.reasoning ?? ""}
                                timestamp={message.timestamp}
                                isStreaming={isStreaming}
                                isError={isError}
                                stages={message.stages ?? []}
                                toolTraces={message.toolTraces ?? []}
                                onSelectAskQuestion={onSelectAskQuestion}
                                onSaveAskAnswer={onSaveAskAnswer}
                                onSendAskAnswers={onSendAskAnswers}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
