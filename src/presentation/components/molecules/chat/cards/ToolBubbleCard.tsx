import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib";
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

export function ToolBubbleCard({
    toolTrace,
    isLoading = false,
}: ToolBubbleCardProps) {
    if (!toolTrace) {
        return null;
    }

    return (
        <div className="w-full text-xs leading-relaxed text-main-200 animate-card-rise-in">
            <Accordeon
                title={`Инструмент: ${toolTrace.toolName || "unknown"}`}
                variant="tool"
                compact
                titleIcon={
                    <span className="flex items-center gap-1.5">
                        <Icon icon="mdi:tools" width={14} height={14} />
                        {isLoading ? <Loader className="h-3 w-3" /> : null}
                    </span>
                }
                subtitle="Аргументы и результат вызова инструмента"
            >
                <div className="space-y-3">
                    <p className="text-[11px] text-main-400">
                        Статус:
                        <span
                            className={
                                toolTrace.status === "done"
                                    ? "text-green-400"
                                    : toolTrace.status === "running"
                                      ? "text-yellow-400"
                                      : toolTrace.status === "pending"
                                        ? "text-amber-400"
                                        : "text-red-400"
                            }
                        >
                            {toolTrace.status}
                        </span>
                    </p>

                    <div>
                        <p className="text-[11px] font-semibold text-main-300">
                            ВЫЗОВ
                        </p>
                        <ShikiCodeBlock
                            code={safeJson(toolTrace.args ?? {})}
                            language="json"
                        />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-main-300">
                            РЕЗУЛЬТАТ
                        </p>
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
            </Accordeon>
        </div>
    );
}
