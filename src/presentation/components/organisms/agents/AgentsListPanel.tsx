import { AgentsListContent } from "./agents/AgentsListContent";
import { AgentsListSidebar } from "./agents/AgentsListSidebar";

export const AgentsListPanel = () => {
    return (
        <section className="flex h-full min-h-0">
            <AgentsListSidebar />
            <AgentsListContent />
        </section>
    );
};
