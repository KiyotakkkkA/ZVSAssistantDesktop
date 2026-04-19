import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { AgentMock, AgentStatus } from "../mockData";

type AgentsListSidebarProps = {
    isLoading: boolean;
    isSubmitting: boolean;
    searchQuery: string;
    agents: AgentMock[];
    selectedAgentId: string | null;
    onSearchQueryChange: (value: string) => void;
    onCreateAgent: () => void;
    onFullRefresh: () => void;
    onSelectAgent: (agentId: string) => void;
};

const statusStyles: Record<AgentStatus, string> = {
    active: "bg-emerald-500/20 text-emerald-300",
    paused: "bg-amber-500/20 text-amber-300",
    draft: "bg-main-600/60 text-main-300",
};

const statusLabels: Record<AgentStatus, string> = {
    active: "Активен",
    paused: "Пауза",
    draft: "Черновик",
};

export const AgentsListSidebar = ({
    isLoading,
    isSubmitting,
    searchQuery,
    agents,
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
                    label="Полный рефреш"
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
                ) : agents.length > 0 ? (
                    <div className="space-y-2">
                        {agents.map((agent) => (
                            <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                    onSelectAgent(agent.id);
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                    agent.id === selectedAgentId
                                        ? "bg-main-600/70"
                                        : "bg-main-900/45 hover:bg-main-700/70"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-main-100">
                                            {agent.name}
                                        </p>
                                        <p className="truncate text-[11px] text-main-400">
                                            {agent.role}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-main-300">
                                        {agent.toolsCount}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] ${statusStyles[agent.status]}`}
                                    >
                                        {statusLabels[agent.status]}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:robot-confused-outline"
                            width={48}
                            height={48}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            Агенты не найдены
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
