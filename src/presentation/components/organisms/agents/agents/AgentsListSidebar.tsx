import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { builtInAgents } from "../../../../../data/BaseModels";
import { useState } from "react";
import { AgentsListUnitCard } from "../../../agents/cards";
import { ButtonCreate } from "../../../atoms";

type AgentsListSidebarProps = {};

export const AgentsListSidebar = ({}: AgentsListSidebarProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredAgents = Object.values(builtInAgents).filter((agent) => {
        if (!normalizedQuery) {
            return true;
        }

        return [agent.agentName, agent.chatLabel].some((field) =>
            field.toLowerCase().includes(normalizedQuery),
        );
    });

    return (
        <aside className="min-h-0 border-b border-main-600/55 w-1/5 border-r p-4">
            <InputSmall
                placeholder="Поиск агентов по имени или роли..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />

            <div className="mt-4 flex items-center gap-2 animate-card-rise-in">
                <ButtonCreate
                    label="Создать агента"
                    className="flex-1"
                    createFn={() => null}
                ></ButtonCreate>
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-10 w-10 p-0"
                >
                    <Icon icon="mdi:refresh" width={18} height={18} />
                </Button>
            </div>

            <PrettyBR
                icon="mdi:robot-outline"
                label="Список агентов"
                className="mt-5 animate-card-rise-in"
            />

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto animate-card-rise-in space-y-4">
                {filteredAgents.length > 0 ? (
                    <div className="space-y-2">
                        {filteredAgents.map((agent) => {
                            const isSelected = selectedAgentId === agent.id;

                            return (
                                <AgentsListUnitCard
                                    key={agent.id}
                                    agent={agent}
                                    isSelected={isSelected}
                                    setSelectedAgentId={setSelectedAgentId}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-main-700/80 bg-main-900/40 p-4 text-center">
                        <Icon
                            icon="mdi:robot-confused-outline"
                            width={36}
                            height={36}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            Агенты по запросу не найдены
                        </p>
                        <p className="text-xs text-main-500">
                            Попробуйте изменить фильтр
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
