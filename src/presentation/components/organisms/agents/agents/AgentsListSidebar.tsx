import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { builtInAgents } from "../../../../../data/BaseModels";

type AgentsListSidebarProps = {
    isLoading: boolean;
    isSubmitting: boolean;
    searchQuery: string;
    selectedAgentId: string | null;
    onSearchQueryChange: (value: string) => void;
    onCreateAgent: () => void;
    onFullRefresh: () => void;
    onSelectAgent: (agentId: string) => void;
};

export const AgentsListSidebar = ({
    isLoading,
    isSubmitting,
    searchQuery,
    selectedAgentId,
    onSearchQueryChange,
    onCreateAgent,
    onFullRefresh,
    onSelectAgent,
}: AgentsListSidebarProps) => {
    return (
        <aside className="min-h-0 border-b border-main-600/55 w-1/5 border-r p-4">
            <InputSmall
                placeholder="Поиск агентов по имени или роли..."
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
            />

            <div className="mt-4 flex items-center gap-2 animate-card-rise-in">
                <Button
                    variant="primary"
                    className="w-full p-1 gap-2 flex-1"
                    shape="rounded-lg"
                    disabled={isSubmitting}
                    onClick={onCreateAgent}
                >
                    <Icon
                        icon="mdi:plus-circle-outline"
                        width={22}
                        height={22}
                    />
                    Создать агента
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
                icon="mdi:robot-outline"
                label="Список агентов"
                className="mt-5 animate-card-rise-in"
            />

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto animate-card-rise-in">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-main-300">
                        Загрузка агентов...
                    </div>
                ) : (
                    <div className="space-y-2">
                        {Object.values(builtInAgents).map((agent) => {
                            return (
                                <div
                                    className="flex group items-center cursor-pointer"
                                    onClick={() => onSelectAgent(agent.id)}
                                >
                                    <div>
                                        <Icon
                                            className="transition-colors bg-main-600 group-hover:bg-main-100 p-1 text-main-100 group-hover:text-main-900 rounded-l-md"
                                            icon={agent.chatIcon}
                                            width={28}
                                            height={28}
                                        />
                                    </div>
                                    <div className="transition-colors pl-2 group-hover:bg-main-600 flex-1 rounded-r-lg">
                                        <span>{agent.agentName}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
};
