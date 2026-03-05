import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "../../../atoms";
import type { ToolTrace } from "../../../../../types/Chat";

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
    create: "Создание плана",
    complete_step: "Завершён шаг",
    get_status: "Проверка статуса",
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
    const progress = latestResult?.progress || "—";
    const isComplete = latestResult?.is_complete === true;
    const pendingSteps = latestResult?.pending_steps || [];
    const completedSteps = latestResult?.completed_steps || [];
    const nextStep = latestResult?.next_step || null;

    return (
        <div className="w-full text-xs leading-relaxed text-main-200">
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
                subtitle={`Шагов: ${traces.length} • Прогресс: ${progress}`}
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
                        {nextStep && (
                            <p className="mt-2 text-[11px] text-main-300">
                                Следующий шаг: {nextStep.id}.{" "}
                                {nextStep.description}
                            </p>
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
                                        <p key={`pending_${step.id}`}>
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
                                        <p key={`done_${step.id}`}>
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
                                const action =
                                    typeof trace.args?.action === "string"
                                        ? trace.args.action
                                        : "unknown";
                                const result = readPlanResult(trace.result);

                                return (
                                    <p key={trace.callId}>
                                        {index + 1}.{" "}
                                        {actionTitle[action] || action}
                                        {result?.progress
                                            ? ` • ${result.progress}`
                                            : ""}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Accordeon>
        </div>
    );
}
