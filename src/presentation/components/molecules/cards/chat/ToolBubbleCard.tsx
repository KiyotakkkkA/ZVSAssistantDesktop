import { Accordeon, Button, Loader } from "../../../atoms";
import { Icon } from "@iconify/react";
import { ShikiCodeBlock } from "../../render/ShikiCodeBlock";
import type { ToolTrace } from "../../../../../types/Chat";

type ToolBubbleCardProps = {
    content: string;
    toolTrace?: ToolTrace;
    onApproveCommandExec?: () => void;
    onRejectCommandExec?: () => void;
    onInterruptCommandExec?: () => void;
    isLoading?: boolean;
};

const parseToolTrace = (raw: string): Partial<ToolTrace> | null => {
    try {
        const parsed = JSON.parse(raw) as Partial<ToolTrace>;

        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

export function ToolBubbleCard({
    content,
    toolTrace,
    onApproveCommandExec,
    onRejectCommandExec,
    onInterruptCommandExec,
    isLoading = false,
}: ToolBubbleCardProps) {
    const payload = toolTrace ?? parseToolTrace(content);

    if (!payload) {
        return (
            <div className="w-full rounded-2xl border border-main-700/60 bg-main-900/60 px-4 py-3 text-xs leading-relaxed text-main-200">
                <pre className="whitespace-pre-wrap wrap-break-word">
                    {content}
                </pre>
            </div>
        );
    }

    if (payload.toolName === "get_tools_calling") {
        return null;
    }

    const isCommandExec = payload.toolName === "command_exec";
    const execStatus = payload.status;
    const needsConfirmation = execStatus === "pending";
    const isCommandRunning = isCommandExec && execStatus === "running";
    const command = typeof payload.command === "string" ? payload.command : "";
    const docId = typeof payload.docId === "string" ? payload.docId : "";
    const cwd = typeof payload.cwd === "string" ? payload.cwd : ".";
    const isAdmin = payload.isAdmin === true;
    const confirmationTitle =
        typeof payload.confirmationTitle === "string"
            ? payload.confirmationTitle
            : "Подтверждение инструмента";
    const confirmationPrompt =
        typeof payload.confirmationPrompt === "string"
            ? payload.confirmationPrompt
            : "Проверь аргументы и подтвердите выполнение.";

    return (
        <div className="w-full text-xs leading-relaxed text-main-200">
            <Accordeon
                title={
                    needsConfirmation
                        ? `ПОДТВЕРЖДЕНИЕ ${payload.toolName || "unknown"}`
                        : `Инструмент: ${payload.toolName || "unknown"}`
                }
                variant="tool"
                compact
                titleIcon={
                    <span className="flex items-center gap-1.5">
                        <Icon icon="mdi:tools" width={14} height={14} />
                        {isLoading ? <Loader className="h-3 w-3" /> : null}
                    </span>
                }
                subtitle={
                    needsConfirmation
                        ? `ИНСТРУМЕНТ ${payload.toolName || "unknown"} ТРЕБУЕТ РУЧНОГО ВМЕШАТЕЛЬСТВА : НАЖМИТЕ, ЧТОБЫ УВИДЕТЬ ПОДРОБНОСТИ`
                        : `Аргументы и результат вызова инструмента`
                }
            >
                <div className="space-y-3">
                    {docId && (
                        <div className="rounded-xl border border-main-500/30 bg-main-800/40 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-main-400">
                                DOC ID
                            </p>
                            <p className="font-mono text-[11px] text-main-100">
                                {docId}
                            </p>
                        </div>
                    )}

                    {(needsConfirmation || isCommandExec) && (
                        <div className="space-y-2 rounded-xl border border-main-700/60 bg-main-900/40 p-3">
                            <p className="text-[11px] font-semibold text-main-300">
                                {needsConfirmation
                                    ? confirmationTitle.toUpperCase()
                                    : "ЗАПРОС НА ВЫПОЛНЕНИЕ"}
                            </p>
                            {needsConfirmation && (
                                <p className="text-[11px] text-main-300">
                                    {confirmationPrompt}
                                </p>
                            )}

                            {isCommandExec && (
                                <>
                                    <p className="text-[11px] text-main-300">
                                        Директория: {cwd}
                                    </p>
                                    <p className="text-[11px] text-main-400">
                                        <ShikiCodeBlock
                                            code={command}
                                            language="powershell"
                                        />
                                    </p>
                                    <p className="text-[11px] text-main-400">
                                        Права администратора:{" "}
                                        <span
                                            className={
                                                isAdmin
                                                    ? "text-green-400"
                                                    : "text-red-400"
                                            }
                                        >
                                            {isAdmin ? "Да" : "Нет"}
                                        </span>
                                    </p>
                                </>
                            )}

                            {needsConfirmation && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="primary"
                                        shape="rounded-lg"
                                        className="h-8 px-3"
                                        onClick={onApproveCommandExec}
                                    >
                                        Подтвердить
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        shape="rounded-lg"
                                        className="h-8 px-3"
                                        onClick={onRejectCommandExec}
                                    >
                                        Отклонить
                                    </Button>
                                </div>
                            )}

                            {isCommandRunning && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        variant="secondary"
                                        shape="rounded-lg"
                                        className="h-8 px-3"
                                        onClick={onInterruptCommandExec}
                                    >
                                        Прервать выполнение
                                    </Button>
                                </div>
                            )}

                            {(needsConfirmation || isCommandExec) &&
                                (execStatus === "accepted" ||
                                    execStatus === "running" ||
                                    execStatus === "cancelled" ||
                                    execStatus === "failed") && (
                                    <p className="text-[11px] text-main-400">
                                        Статус:{" "}
                                        <span
                                            className={`${execStatus === "accepted" ? "text-green-400" : execStatus === "running" ? "text-yellow-400" : "text-red-400"}`}
                                        >
                                            {execStatus === "accepted"
                                                ? "Подтверждено"
                                                : execStatus === "running"
                                                  ? "Выполняется"
                                                  : execStatus === "failed"
                                                    ? "Ошибка выполнения"
                                                    : "Остановлено"}
                                        </span>
                                    </p>
                                )}
                        </div>
                    )}

                    <div>
                        <p className="text-[11px] font-semibold text-main-300">
                            ВЫЗОВ
                        </p>
                        <ShikiCodeBlock
                            code={JSON.stringify(payload.args ?? {}, null, 2)}
                            language={"json"}
                        />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-main-300">
                            РЕЗУЛЬТАТ
                        </p>
                        <ShikiCodeBlock
                            code={JSON.stringify(payload.result ?? {}, null, 2)}
                            language={"json"}
                        />
                    </div>
                </div>
            </Accordeon>
        </div>
    );
}
