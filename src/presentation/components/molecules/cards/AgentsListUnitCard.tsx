import { Icon } from "@iconify/react";
import { Agent } from "../../../../../electron/models/agent";

interface AgentsListUnitCardProps {
    agent: Agent;
    isSelected: boolean;
    setSelectedAgentId: (id: string) => void;
}

export const AgentsListUnitCard = ({
    agent,
    isSelected,
    setSelectedAgentId,
}: AgentsListUnitCardProps) => {
    return (
        <div
            onClick={() => {
                setSelectedAgentId(agent.id);
            }}
            className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer border-transparent ${
                isSelected
                    ? " bg-main-600/65"
                    : " bg-main-900/45 hover:bg-main-700/40"
            }`}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`rounded-lg p-2 transition-colors ${
                        isSelected
                            ? "bg-main-100 text-main-900"
                            : "bg-main-700/85 text-main-200"
                    }`}
                >
                    <Icon icon={agent.chatIcon} width={18} height={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm text-main-100">
                            {agent.agentName}
                        </p>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                        <span className="rounded-md bg-main-700/65 px-2 py-0.5 text-main-200">
                            Инструментов: {agent.agentToolsSet.length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
