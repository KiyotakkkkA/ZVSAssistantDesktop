import { Switcher } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useState } from "react";
import { AgentsListPanel } from "../../components/organisms/agents/AgentsListPanel";
import { AgentsMcpPanel } from "../../components/organisms/agents/AgentsMcpPanel";
import { AgentsScenariosPanel } from "../../components/organisms/agents/AgentsScenariosPanel";

type AllowedOptions = "mcp" | "agents" | "scenarios";

const options: { label: string; value: AllowedOptions }[] = [
    { label: "MCP", value: "mcp" },
    { label: "Список агентов", value: "agents" },
    { label: "Сценарии", value: "scenarios" },
];

const renderSection = (option: AllowedOptions) => {
    switch (option) {
        case "mcp":
            return <AgentsMcpPanel />;
        case "agents":
            return <AgentsListPanel />;
        case "scenarios":
            return <AgentsScenariosPanel />;
    }
};

export const AgentsViewPage = () => {
    const [selectedOption, setSelectedOption] = useState<AllowedOptions>("mcp");

    const handleOptionChange = (value: string) => {
        setSelectedOption(value as AllowedOptions);
    };

    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl mb-3">Агенты</h1>
                <Switcher
                    options={options}
                    value={selectedOption}
                    onChange={handleOptionChange}
                    className="border-transparent"
                />
            </div>
            {renderSection(selectedOption)}
        </div>
    );
};
