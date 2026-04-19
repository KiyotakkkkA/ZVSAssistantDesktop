import { Icon } from "@iconify/react";
import { Button, Separator } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { ScenarioMock, ScenarioStatus } from "../mockData";

type AgentsScenariosContentProps = {
    selectedScenario: ScenarioMock | null;
    isSubmitting: boolean;
    onToggleStatus: () => void;
    onDuplicateScenario: () => void;
};

const statusStyles: Record<ScenarioStatus, string> = {
    ready: "bg-emerald-500/20 text-emerald-300",
    "needs-config": "bg-amber-500/20 text-amber-300",
    disabled: "bg-main-600/60 text-main-300",
};

const statusLabels: Record<ScenarioStatus, string> = {
    ready: "Готов",
    "needs-config": "Нужна настройка",
    disabled: "Отключен",
};

const getActionLabel = (status: ScenarioStatus) => {
    if (status === "disabled") {
        return "Включить";
    }

    return "Сменить статус";
};

export const AgentsScenariosContent = ({
    selectedScenario,
    isSubmitting,
    onToggleStatus,
    onDuplicateScenario,
}: AgentsScenariosContentProps) => {
    if (!selectedScenario) {
        return (
            <div className="flex-1 p-4 animate-card-rise-in">
                <div className="flex h-full flex-col items-center justify-center gap-3">
                    <Icon
                        icon="mdi:script-text-outline"
                        width={64}
                        height={64}
                        className="text-main-500"
                    />
                    <p className="text-sm text-main-300">
                        Выберите сценарий слева
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 animate-card-rise-in">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-base text-main-100">
                        Контент сценария
                    </h3>
                    <p className="text-xs text-main-400">
                        Последний запуск: {selectedScenario.lastRun}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        label={getActionLabel(selectedScenario.status)}
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-3"
                        disabled={isSubmitting}
                        onClick={onToggleStatus}
                    >
                        <Icon icon="mdi:play-outline" />
                    </Button>
                    <Button
                        label="Дублировать"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-3"
                        disabled={isSubmitting}
                        onClick={onDuplicateScenario}
                    >
                        <Icon icon="mdi:content-copy" />
                    </Button>
                    <Separator
                        orientation="vertical"
                        className="h-5 bg-main-400"
                    />
                    <Button
                        label="Запуск"
                        variant="success"
                        shape="rounded-lg"
                        className="h-9 px-3 text-main-900"
                        disabled={
                            isSubmitting ||
                            selectedScenario.status === "disabled"
                        }
                    >
                        <Icon icon="mdi:rocket-launch-outline" />
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h4 className="text-lg text-main-100">
                        {selectedScenario.name}
                    </h4>
                    <span
                        className={`rounded-md px-2 py-1 text-xs ${statusStyles[selectedScenario.status]}`}
                    >
                        {statusLabels[selectedScenario.status]}
                    </span>
                </div>

                <p className="text-sm text-main-200 leading-relaxed">
                    {selectedScenario.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-main-300">
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Триггер: {selectedScenario.trigger}
                    </div>
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Владелец: {selectedScenario.owner}
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                    <p className="mb-2 text-xs text-main-400">
                        Шаги исполнения
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-main-200">
                        {selectedScenario.steps.map((step, index) => (
                            <li key={`${selectedScenario.id}-${index}`}>
                                {step}
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    );
};
