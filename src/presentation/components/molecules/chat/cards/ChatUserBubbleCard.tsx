type ChatUserBubbleCardProps = {
    content: string;
    timestamp?: string;
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

export function ChatUserBubbleCard({
    content,
    timestamp,
}: ChatUserBubbleCardProps) {
    const safeContent = normalizeRenderText(content);

    return (
        <article className="flex flex-col">
            <div className="flex justify-end gap-3">
                <div className="max-w-[72%] rounded-2xl bg-main-500/20 px-4 py-3 text-sm leading-relaxed text-main-100 ring-main-300/30">
                    <p className="whitespace-pre-wrap wrap-break-word">
                        {safeContent}
                    </p>
                    {timestamp ? (
                        <p className="mt-2 text-[11px] text-main-400">
                            {timestamp}
                        </p>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
