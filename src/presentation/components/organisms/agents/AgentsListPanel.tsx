import { useState } from "react";
import { baseModelList } from "../../../../data/BaseModels";
import { AgentsListContent } from "./agents/AgentsListContent";
import { AgentsListSidebar } from "./agents/AgentsListSidebar";

export const AgentsListPanel = () => {
    const [selectedAgentId, setSelectedAgentId] = useState(
        baseModelList[0]?.id ?? null,
    );
    const selectedAgent =
        baseModelList.find((agent) => agent.id === selectedAgentId) ?? null;

    return (
        <section className="flex h-full min-h-0">
            <AgentsListSidebar
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
            />
            <AgentsListContent selectedAgent={selectedAgent} />
        </section>
    );
};
