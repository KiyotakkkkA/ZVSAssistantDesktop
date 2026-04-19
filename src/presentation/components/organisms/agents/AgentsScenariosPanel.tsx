import { useEffect, useMemo, useState } from "react";
import { SCENARIOS_MOCK_DATA } from "./mockData";
import type { ScenarioMock, ScenarioStatus } from "./mockData";
import { AgentsScenariosContent } from "./scenarios/AgentsScenariosContent";
import { AgentsScenariosSidebar } from "./scenarios/AgentsScenariosSidebar";

const getNextScenarioStatus = (status: ScenarioStatus): ScenarioStatus => {
    if (status === "ready") {
        return "disabled";
    }

    if (status === "disabled") {
        return "needs-config";
    }

    return "ready";
};

export const AgentsScenariosPanel = () => {
    const [scenarios, setScenarios] =
        useState<ScenarioMock[]>(SCENARIOS_MOCK_DATA);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
        SCENARIOS_MOCK_DATA[0]?.id ?? null,
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredScenarios = useMemo(() => {
        if (!normalizedQuery) {
            return scenarios;
        }

        return scenarios.filter(
            (scenario) =>
                scenario.name.toLowerCase().includes(normalizedQuery) ||
                scenario.owner.toLowerCase().includes(normalizedQuery) ||
                scenario.trigger.toLowerCase().includes(normalizedQuery),
        );
    }, [normalizedQuery, scenarios]);

    const selectedScenario =
        scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
        null;

    useEffect(() => {
        if (
            !selectedScenarioId ||
            scenarios.some((item) => item.id === selectedScenarioId)
        ) {
            return;
        }

        setSelectedScenarioId(scenarios[0]?.id ?? null);
    }, [scenarios, selectedScenarioId]);

    const handleCreateScenario = () => {
        const nextIndex = scenarios.length + 1;
        const nextScenario: ScenarioMock = {
            id: `scenario-demo-${nextIndex}`,
            name: `Новый сценарий ${nextIndex}`,
            status: "needs-config",
            trigger: "Ручной запуск",
            owner: "Команда",
            lastRun: "никогда",
            description: "Черновой сценарий для демонстрации интерфейса.",
            steps: [
                "Определить входные данные",
                "Добавить шаги исполнения",
                "Сохранить конфигурацию",
            ],
        };

        setScenarios((prev) => [nextScenario, ...prev]);
        setSelectedScenarioId(nextScenario.id);
    };

    const handleFullRefresh = () => {
        setScenarios((prev) =>
            prev.map((scenario, index) => {
                if (index !== 0) {
                    return scenario;
                }

                return {
                    ...scenario,
                    lastRun: "только что",
                };
            }),
        );
    };

    const handleToggleScenarioStatus = () => {
        if (!selectedScenario) {
            return;
        }

        setScenarios((prev) =>
            prev.map((scenario) => {
                if (scenario.id !== selectedScenario.id) {
                    return scenario;
                }

                return {
                    ...scenario,
                    status: getNextScenarioStatus(scenario.status),
                };
            }),
        );
    };

    const handleDuplicateScenario = () => {
        if (!selectedScenario) {
            return;
        }

        const duplicated: ScenarioMock = {
            ...selectedScenario,
            id: `${selectedScenario.id}-copy-${scenarios.length + 1}`,
            name: `${selectedScenario.name} (копия)`,
            status: "needs-config",
            lastRun: "никогда",
        };

        setScenarios((prev) => [duplicated, ...prev]);
        setSelectedScenarioId(duplicated.id);
    };

    return (
        <section className="flex h-full min-h-0">
            <AgentsScenariosSidebar
                isLoading={false}
                isSubmitting={false}
                searchQuery={searchQuery}
                scenarios={filteredScenarios}
                selectedScenarioId={selectedScenario?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateScenario={handleCreateScenario}
                onFullRefresh={handleFullRefresh}
                onSelectScenario={setSelectedScenarioId}
            />
            <AgentsScenariosContent
                selectedScenario={selectedScenario}
                isSubmitting={false}
                onToggleStatus={handleToggleScenarioStatus}
                onDuplicateScenario={handleDuplicateScenario}
            />
        </section>
    );
};
