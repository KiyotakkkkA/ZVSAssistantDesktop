import { MarkdownStaticContent } from "../../render";

type ChatAssistantBubbleCardProps = {
    content: string;
    timestamp?: string;
    isStreaming?: boolean;
    isError?: boolean;
};

const normalizeRenderText = (value: unknown) => {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Error) {
        return value.message;
    }

    if (value == null) {
        return "";
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export function ChatAssistantBubbleCard({
    content,
    timestamp,
    isStreaming = false,
    isError = false,
}: ChatAssistantBubbleCardProps) {
    const safeContent = normalizeRenderText(content);
    const showStreamingPlaceholder = isStreaming && !safeContent.trim();

    return (
        <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-main-100">
            <div className={isError ? "text-red-300" : "text-main-100"}>
                {showStreamingPlaceholder ? (
                    <p className="text-sm text-main-400">Модель печатает...</p>
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
