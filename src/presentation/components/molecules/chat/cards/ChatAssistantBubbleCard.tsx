import { resolveText } from "../../../../../utils/resolvers";
import { MarkdownStaticContent } from "../../render";

type ChatAssistantBubbleCardProps = {
    content: string;
    timestamp?: string;
    isStreaming?: boolean;
    isError?: boolean;
};

export function ChatAssistantBubbleCard({
    content,
    timestamp,
    isStreaming = false,
    isError = false,
}: ChatAssistantBubbleCardProps) {
    const safeContent = resolveText(content);
    const showStreamingPlaceholder = isStreaming && !safeContent.trim();

    return (
        <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-main-100">
            <div className={isError ? "text-red-300" : "text-main-100"}>
                {showStreamingPlaceholder ? (
                    <p className="typing-gradient-text text-sm">
                        Модель печатает...
                    </p>
                ) : (
                    <MarkdownStaticContent content={safeContent} />
                )}
            </div>
            {timestamp ? (
                <p className="mt-2 text-[11px] text-main-400">{timestamp}</p>
            ) : null}
        </div>
    );
}
