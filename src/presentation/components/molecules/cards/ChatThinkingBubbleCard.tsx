import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { resolveText } from "../../../../utils/resolvers";

type ThinkingBubbleCardProps = {
    content: string;
    isLoading?: boolean;
};

export function ChatThinkingBubbleCard({
    content,
    isLoading = false,
}: ThinkingBubbleCardProps) {
    const safeContent = resolveText(content);

    if (!safeContent.trim()) {
        return null;
    }

    return (
        <div className="text-xs leading-relaxed text-main-200">
            <Accordeon className="max-w-172">
                <Accordeon.Summary>
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 flex items-center gap-1.5 text-main-200">
                            <Icon
                                icon="mdi:head-lightbulb-outline"
                                width={14}
                                height={14}
                            />
                            {isLoading ? <Loader className="h-3 w-3" /> : null}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-main-100">
                                Размышления
                            </p>
                            <p className="text-[11px] text-main-400">
                                Размышления ассистента в процессе генерации
                                ответа
                            </p>
                        </div>
                    </div>
                </Accordeon.Summary>

                <Accordeon.Content>
                    <pre className="whitespace-pre-wrap wrap-break-word text-[11px] text-main-200">
                        {safeContent}
                    </pre>
                </Accordeon.Content>
            </Accordeon>
        </div>
    );
}
