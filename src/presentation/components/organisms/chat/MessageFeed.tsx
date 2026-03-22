import { useEffect, useRef } from "react";
import { ChatUserBubbleCard } from "../../molecules/chat/cards";
import { AssistantResponse } from "./AssistantResponse";
import { DialogUiMessage } from "../../../../../electron/models";

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
}: MessageFeedProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!scrollRef.current) {
            return;
        }

        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
                                content={message.content}
                                reasoning={message.reasoning ?? ""}
                                timestamp={message.timestamp}
                                isStreaming={isStreaming}
                                isError={isError}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
