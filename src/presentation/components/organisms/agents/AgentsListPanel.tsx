import { observer } from "mobx-react-lite";
import { useState } from "react";
import { agentsStore } from "../../../../stores/agentsStore";
import { AgentsListContent } from "./agents/AgentsListContent";
import { AgentsListSidebar } from "./agents/AgentsListSidebar";

export const AgentsListPanel = observer(() => {
    const [selectedAgentId, setSelectedAgentId] = useState(
        agentsStore.agents[0]?.id ?? null,
    );
    const selectedAgent =
        agentsStore.agents.find((agent) => agent.id === selectedAgentId) ??
        agentsStore.agents[0] ??
        null;

    return (
        <section className="flex h-full min-h-0">
            <AgentsListSidebar
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
            />
            <AgentsListContent selectedAgent={selectedAgent} />
        </section>
    );
});
