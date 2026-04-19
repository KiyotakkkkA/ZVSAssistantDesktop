import { useEffect, useMemo, useState } from "react";
import { AGENTS_MOCK_DATA } from "./mockData";
import type { AgentMock, AgentStatus } from "./mockData";
import { AgentsListContent } from "./agents/AgentsListContent";
import { AgentsListSidebar } from "./agents/AgentsListSidebar";

const getNextAgentStatus = (status: AgentStatus): AgentStatus => {
    if (status === "active") {
        return "paused";
    }

    return "active";
};

export const AgentsListPanel = () => {
    const [agents, setAgents] = useState<AgentMock[]>(AGENTS_MOCK_DATA);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
        AGENTS_MOCK_DATA[0]?.id ?? null,
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredAgents = useMemo(() => {
        if (!normalizedQuery) {
            return agents;
        }

        return agents.filter(
            (agent) =>
                agent.name.toLowerCase().includes(normalizedQuery) ||
                agent.role.toLowerCase().includes(normalizedQuery) ||
                agent.model.toLowerCase().includes(normalizedQuery),
        );
    }, [agents, normalizedQuery]);

    const selectedAgent =
        agents.find((agent) => agent.id === selectedAgentId) ?? null;

    useEffect(() => {
        if (
            !selectedAgentId ||
            agents.some((item) => item.id === selectedAgentId)
        ) {
            return;
        }

        setSelectedAgentId(agents[0]?.id ?? null);
    }, [agents, selectedAgentId]);

    const handleCreateAgent = () => {
        const nextIndex = agents.length + 1;
        const nextAgent: AgentMock = {
            id: `agent-demo-${nextIndex}`,
            name: `Новый агент ${nextIndex}`,
            role: "Новый демонстрационный агент",
            model: "gpt-5.1-mini",
            status: "draft",
            toolsCount: 1,
            updatedAt: "только что",
            description:
                "Черновой агент, созданный для проверки интерфейса списка агентов.",
            tags: ["demo", "draft"],
        };

        setAgents((prev) => [nextAgent, ...prev]);
        setSelectedAgentId(nextAgent.id);
    };

    const handleFullRefresh = () => {
        setAgents((prev) =>
            prev.map((agent, index) => {
                if (index !== 0) {
                    return agent;
                }

                return {
                    ...agent,
                    updatedAt: "только что",
                };
            }),
        );
    };

    const handleToggleAgentStatus = () => {
        if (!selectedAgent) {
            return;
        }

        setAgents((prev) =>
            prev.map((agent) => {
                if (agent.id !== selectedAgent.id) {
                    return agent;
                }

                return {
                    ...agent,
                    status:
                        agent.status === "draft"
                            ? "active"
                            : getNextAgentStatus(agent.status),
                    updatedAt: "только что",
                };
            }),
        );
    };

    const handleCloneAgent = () => {
        if (!selectedAgent) {
            return;
        }

        const cloned: AgentMock = {
            ...selectedAgent,
            id: `${selectedAgent.id}-copy-${agents.length + 1}`,
            name: `${selectedAgent.name} (копия)`,
            status: "draft",
            updatedAt: "только что",
        };

        setAgents((prev) => [cloned, ...prev]);
        setSelectedAgentId(cloned.id);
    };

    const handleDeleteAgent = () => {
        if (!selectedAgent) {
            return;
        }

        setAgents((prev) =>
            prev.filter((agent) => agent.id !== selectedAgent.id),
        );
    };

    return (
        <section className="flex h-full min-h-0">
            <AgentsListSidebar
                isLoading={false}
                isSubmitting={false}
                searchQuery={searchQuery}
                agents={filteredAgents}
                selectedAgentId={selectedAgent?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateAgent={handleCreateAgent}
                onFullRefresh={handleFullRefresh}
                onSelectAgent={setSelectedAgentId}
            />
            <AgentsListContent
                selectedAgent={selectedAgent}
                isSubmitting={false}
                onToggleStatus={handleToggleAgentStatus}
                onCloneAgent={handleCloneAgent}
                onDeleteAgent={handleDeleteAgent}
            />
        </section>
    );
};
