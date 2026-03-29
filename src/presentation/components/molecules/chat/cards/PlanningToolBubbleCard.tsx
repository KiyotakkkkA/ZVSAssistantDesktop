import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib";
import type { ToolTrace } from "../../../../../../electron/models/tool";

type PlanningToolBubbleCardProps = {
    traces: ToolTrace[];
    isLoading?: boolean;
};

type PlanStepSummary = {
    id: number;
    description: string;
};

type PlanResultShape = {
    plan_id?: string;
    title?: string;
    progress?: string;
    is_complete?: boolean;
    next_step?: PlanStepSummary | null;
    pending_steps?: PlanStepSummary[];
    completed_steps?: PlanStepSummary[];
};

type PlanProgress = {
    done: number;
    total: number;
    percent: number;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
};

const readPlanStep = (value: unknown): PlanStepSummary | null => {
    const record = toRecord(value);

    if (!record) {
        return null;
    }

    const id = typeof record.id === "number" ? record.id : null;
    const description =
        typeof record.description === "string" ? record.description : null;

    if (id === null || !description) {
        return null;
    }

    return { id, description };
};

const readPlanSteps = (value: unknown): PlanStepSummary[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => readPlanStep(item))
        .filter((item): item is PlanStepSummary => item !== null);
};

const readPlanResult = (value: unknown): PlanResultShape | null => {
    const record = toRecord(value);

    if (!record) {
        return null;
    }

    return {
        plan_id:
            typeof record.plan_id === "string" ? record.plan_id : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        progress:
            typeof record.progress === "string" ? record.progress : undefined,
        is_complete:
            typeof record.is_complete === "boolean"
                ? record.is_complete
                : undefined,
        next_step: readPlanStep(record.next_step),
        pending_steps: readPlanSteps(record.pending_steps),
        completed_steps: readPlanSteps(record.completed_steps),
    };
};

const actionTitle: Record<string, string> = {
    createSteps: "Создание плана",
    markStep: "Завершен шаг",
    getNextStep: "Проверка следующего шага",
    create: "Создание плана",
    complete_step: "Завершен шаг",
    get_status: "Проверка следующего шага",
};

const parseProgress = (raw: string | undefined): PlanProgress => {
    if (!raw) {
        return { done: 0, total: 0, percent: 0 };
    }

    const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/);

    if (!match) {
        return { done: 0, total: 0, percent: 0 };
    }

    const done = Number(match[1]);
    const total = Number(match[2]);

    if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) {
        return { done: 0, total: 0, percent: 0 };
    }

    return {
        done,
        total,
        percent: Math.max(0, Math.min(100, Math.round((done / total) * 100))),
    };
};

const resolveTraceAction = (trace: ToolTrace) => {
    const argsRecord = toRecord(trace.args);

    const fromType = argsRecord?.type;
    if (typeof fromType === "string" && fromType.length > 0) {
        return fromType;
    }

    const fromAction = argsRecord?.action;
    if (typeof fromAction === "string" && fromAction.length > 0) {
        return fromAction;
    }

    return "unknown";
};

export function PlanningToolBubbleCard({
    traces,
    isLoading = false,
}: PlanningToolBubbleCardProps) {
    const latestResult =
        [...traces]
            .reverse()
            .map((trace) => readPlanResult(trace.result))
            .find((result) => result !== null) ?? null;

    const planTitle = latestResult?.title || "План выполнения";
    const progress = latestResult?.progress || "-";
    const isComplete = latestResult?.is_complete === true;
    const pendingSteps = latestResult?.pending_steps || [];
    const completedSteps = latestResult?.completed_steps || [];
    const nextStep = latestResult?.next_step || null;
    const progressMeta = parseProgress(latestResult?.progress);
    const totalStepsCount =
        progressMeta.total || pendingSteps.length + completedSteps.length;

    return (
        <div className="text-xs leading-relaxed text-main-200 animate-card-rise-in">
            <Accordeon
                title={`План: ${planTitle}`}
                variant="plan"
                compact
                titleIcon={
                    <span className="flex items-center gap-1.5">
                        <Icon
                            icon="mdi:clipboard-text-outline"
                            width={14}
                            height={14}
                        />
                        {isLoading ? <Loader className="h-3 w-3" /> : null}
                    </span>
                }
                rightSlot={
                    <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] leading-none ${
                            isComplete
                                ? "border-main-600/80 text-green-400"
                                : "border-main-700/80 text-main-300"
                        }`}
                    >
                        {isComplete ? "готово" : "в работе"}
                    </span>
                }
                subtitle={`Шагов: ${totalStepsCount || "-"} • Прогресс: ${progress}`}
                className="max-w-172"
            >
                <div className="space-y-3">
                    <div className="rounded-xl border border-main-700/60 bg-main-900/40 p-3">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-main-300">Статус</span>
                            <span
                                className={
                                    isComplete
                                        ? "text-green-400"
                                        : "text-main-200"
                                }
                            >
                                {isComplete ? "Готово" : "В работе"}
                            </span>
                        </div>

                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-main-800/90">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    isComplete
                                        ? "bg-emerald-400"
                                        : "bg-main-400"
                                }`}
                                style={{
                                    width: `${isComplete ? 100 : progressMeta.percent}%`,
                                }}
                            />
                        </div>

                        <p className="mt-2 text-[11px] text-main-400">
                            Выполнено: {progressMeta.done}/{progressMeta.total}
                            {progressMeta.total > 0
                                ? ` (${progressMeta.percent}%)`
                                : ""}
                        </p>

                        {nextStep && (
                            <div className="mt-3 rounded-lg border border-main-700/70 bg-main-800/45 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-main-400">
                                    Следующий шаг
                                </p>
                                <p className="mt-1 text-[11px] text-main-200">
                                    {nextStep.id}. {nextStep.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <p className="mb-1 text-[11px] font-semibold text-main-300">
                                ОСТАЛОСЬ
                            </p>
                            <div className="space-y-1 text-[11px]">
                                {pendingSteps.length ? (
                                    pendingSteps.map((step) => (
                                        <p
                                            key={`pending_${step.id}`}
                                            className="rounded-md bg-main-900/45 px-2 py-1"
                                        >
                                            {step.id}. {step.description}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-main-400">Нет</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-[11px] font-semibold text-main-300">
                                ВЫПОЛНЕНО
                            </p>
                            <div className="space-y-1 text-[11px]">
                                {completedSteps.length ? (
                                    completedSteps.map((step) => (
                                        <p
                                            key={`done_${step.id}`}
                                            className="rounded-md bg-emerald-500/10 px-2 py-1 text-main-200"
                                        >
                                            {step.id}. {step.description}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-main-400">Пока нет</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="mb-1 text-[11px] font-semibold text-main-300">
                            ИСТОРИЯ ВЫЗОВОВ
                        </p>
                        <div className="space-y-1 text-[11px] text-main-300">
                            {traces.map((trace, index) => {
                                const action = resolveTraceAction(trace);
                                const result = readPlanResult(trace.result);
                                const statusLabel =
                                    trace.status === "done"
                                        ? "ok"
                                        : trace.status === "running"
                                          ? "run"
                                          : trace.status === "pending"
                                            ? "wait"
                                            : "err";

                                return (
                                    <div
                                        key={trace.callId}
                                        className="flex items-center justify-between gap-2 rounded-md bg-main-900/35 px-2 py-1"
                                    >
                                        <p>
                                            {index + 1}.{" "}
                                            {actionTitle[action] || action}
                                            {result?.progress
                                                ? ` • ${result.progress}`
                                                : ""}
                                        </p>
                                        <span className="text-[10px] uppercase text-main-400">
                                            {statusLabel}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Accordeon>
        </div>
    );
}
