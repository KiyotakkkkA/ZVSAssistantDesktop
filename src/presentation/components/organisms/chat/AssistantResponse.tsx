import {
    ChatAssistantBubbleCard,
    ThinkingBubbleCard,
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
    return (
        <article className="flex justify-start">
            <div className="w-full max-w-[72%] space-y-2">
                <ThinkingBubbleCard
                    content={reasoning}
                    isLoading={isStreaming}
                />
                <ChatAssistantBubbleCard
                    content={content}
                    timestamp={timestamp}
                    isStreaming={isStreaming}
                    isError={isError}
                />
            </div>
        </article>
    );
};
