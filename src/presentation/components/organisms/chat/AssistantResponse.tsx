import { Icon } from "@iconify/react";
import {
    ChatAssistantBubbleCard,
    ChatThinkingBubbleCard,
} from "../../molecules/chat/cards";

type AssistantResponseProps = {
    content: string;
    reasoning?: string;
    timestamp?: string;
    isStreaming?: boolean;
    isError?: boolean;
};

export const AssistantResponse = ({
    content,
    reasoning = "",
    timestamp,
    isStreaming = false,
    isError = false,
}: AssistantResponseProps) => {
    const hasReasoning = Boolean(reasoning.trim());

    return (
        <article className="flex justify-start">
            <div className="relative w-full max-w-[72%] pl-9">
                <div className="pointer-events-none absolute bottom-4 left-3.5 top-3 w-px bg-main-700/70" />

                <div className="space-y-2">
                    {hasReasoning ? (
                        <div className="relative grid grid-cols-[auto_1fr] items-start gap-3">
                            <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                <Icon
                                    icon="mdi:head-lightbulb-outline"
                                    width={12}
                                    height={12}
                                    className="text-main-300"
                                />
                            </span>

                            <ChatThinkingBubbleCard
                                content={reasoning}
                                isLoading={isStreaming}
                            />
                        </div>
                    ) : null}

                    <div className="relative grid grid-cols-[auto_1fr] items-start gap-3">
                        <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                            <Icon
                                icon="mdi:message-text-outline"
                                width={12}
                                height={12}
                                className="text-main-300"
                            />
                        </span>

                        <ChatAssistantBubbleCard
                            content={content}
                            timestamp={timestamp}
                            isStreaming={isStreaming}
                            isError={isError}
                        />
                    </div>
                </div>
            </div>
        </article>
    );
};
