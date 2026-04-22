import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { ScenarioMock, ScenarioStatus } from "../mockData";

type AgentsScenariosSidebarProps = {
    isLoading: boolean;
    isSubmitting: boolean;
    searchQuery: string;
    scenarios: ScenarioMock[];
    selectedScenarioId: string | null;
    onSearchQueryChange: (value: string) => void;
    onCreateScenario: () => void;
    onFullRefresh: () => void;
    onSelectScenario: (scenarioId: string) => void;
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

export const AgentsScenariosSidebar = ({
    isLoading,
    isSubmitting,
    searchQuery,
    scenarios,
    selectedScenarioId,
    onSearchQueryChange,
    onCreateScenario,
    onFullRefresh,
    onSelectScenario,
}: AgentsScenariosSidebarProps) => {
    return (
        <aside className="min-h-0 border-b border-main-600/55 w-1/5 border-r p-4">
            <InputSmall
                placeholder="Поиск сценариев по имени или владельцу..."
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
            />

            <div className="mt-4 flex items-center gap-2 animate-card-rise-in">
                <Button
                    variant="primary"
                    className="w-full p-1 gap-2 flex-1"
                    shape="rounded-lg"
                    disabled={isSubmitting}
                    onClick={onCreateScenario}
                >
                    <Icon
                        icon="mdi:plus-circle-outline"
                        width={22}
                        height={22}
                    />
                    Создать сценарий
                </Button>
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-10 w-10 p-0"
                    disabled={isLoading || isSubmitting}
                    onClick={onFullRefresh}
                >
                    <Icon icon="mdi:refresh" width={18} height={18} />
                </Button>
            </div>

            <PrettyBR
                icon="mdi:script-text-outline"
                label="Сценарии"
                className="mt-5 animate-card-rise-in"
            />

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto animate-card-rise-in">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-main-300">
                        Загрузка сценариев...
                    </div>
                ) : scenarios.length > 0 ? (
                    <div className="space-y-2">
                        {scenarios.map((scenario) => (
                            <button
                                key={scenario.id}
                                type="button"
                                onClick={() => {
                                    onSelectScenario(scenario.id);
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                    scenario.id === selectedScenarioId
                                        ? "bg-main-600/70"
                                        : "bg-main-900/45 hover:bg-main-700/70"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-main-100">
                                            {scenario.name}
                                        </p>
                                        <p className="truncate text-[11px] text-main-400">
                                            {scenario.trigger}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-main-300">
                                        {scenario.steps.length}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] ${statusStyles[scenario.status]}`}
                                    >
                                        {statusLabels[scenario.status]}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:script-text-play-outline"
                            width={48}
                            height={48}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            Сценарии не найдены
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
