import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib";

type ThinkingBubbleCardProps = {
    content: string;
    isLoading?: boolean;
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

export function ThinkingBubbleCard({
    content,
    isLoading = false,
}: ThinkingBubbleCardProps) {
    const safeContent = normalizeRenderText(content);

    if (!safeContent.trim()) {
        return null;
    }

    return (
        <div className="text-xs leading-relaxed text-main-200">
            <Accordeon
                title="Размышления"
                subtitle="Размышления ассистента в процессе генерации ответа"
                variant="thinking"
                compact
                titleIcon={
                    <span className="flex items-center gap-1.5">
                        <Icon
                            icon="mdi:head-lightbulb-outline"
                            width={14}
                            height={14}
                        />
                        {isLoading ? <Loader className="h-3 w-3" /> : null}
                    </span>
                }
            >
                <pre className="whitespace-pre-wrap wrap-break-word text-[11px] text-main-200">
                    {safeContent}
                </pre>
            </Accordeon>
        </div>
    );
}
