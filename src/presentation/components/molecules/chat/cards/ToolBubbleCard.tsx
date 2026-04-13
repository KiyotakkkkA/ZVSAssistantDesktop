import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { ShikiCodeBlock } from "../../render/ShikiCodeBlock";
import type { ToolTrace } from "../../../../../../electron/models/tool";

type ToolBubbleCardProps = {
    toolTrace?: ToolTrace;
    isLoading?: boolean;
};

const safeJson = (value: unknown) => {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return String(value ?? "{}");
    }
};

const statuses = {
    done: {
        color: "text-green-400",
        label: "Выполнено",
    },
    running: {
        color: "text-yellow-400",
        label: "Выполняется",
    },
    pending: {
        color: "text-amber-400",
        label: "Ожидает выполнения",
    },
    error: {
        color: "text-red-400",
        label: "Ошибка при выполнении",
    },
};

export function ToolBubbleCard({
    toolTrace,
    isLoading = false,
}: ToolBubbleCardProps) {
    if (!toolTrace) {
        return null;
    }

    return (
        <div className="text-xs leading-relaxed text-main-200 animate-card-rise-in">
            <Accordeon className="max-w-172">
                <Accordeon.Summary>
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 flex items-center gap-1.5 text-main-200">
                            <Icon icon="mdi:tools" width={14} height={14} />
                            {isLoading ? <Loader className="h-3 w-3" /> : null}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-main-100">
                                Инструмент: {toolTrace.toolName || "unknown"}
                            </p>
                            <p className="text-[11px] text-main-400">
                                Аргументы и результат вызова инструмента
                            </p>
                        </div>
                    </div>
                </Accordeon.Summary>

                <Accordeon.Content>
                    <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                        <p className="text-[11px] text-main-400">
                            Статус:
                            <span
                                className={
                                    statuses[
                                        toolTrace.status as keyof typeof statuses
                                    ]?.color || "text-main-400"
                                }
                            >
                                {statuses[
                                    toolTrace.status as keyof typeof statuses
                                ]?.label || toolTrace.status}
                            </span>
                        </p>

                        <div>
                            <p className="text-[11px] font-semibold text-main-300">
                                ВЫЗОВ
                            </p>
                            <div className="max-h-72 overflow-y-auto rounded-xl">
                                <ShikiCodeBlock
                                    code={safeJson(toolTrace.args ?? {})}
                                    language="json"
                                />
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-main-300">
                                РЕЗУЛЬТАТ
                            </p>
                            <div className="max-h-72 overflow-y-auto rounded-xl">
                                <ShikiCodeBlock
                                    code={safeJson(
                                        toolTrace.error
                                            ? { error: toolTrace.error }
                                            : (toolTrace.result ?? {}),
                                    )}
                                    language="json"
                                />
                            </div>
                        </div>
                    </div>
                </Accordeon.Content>
            </Accordeon>
        </div>
    );
}
