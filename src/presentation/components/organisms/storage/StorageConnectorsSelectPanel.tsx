import { Icon } from "@iconify/react";
import { useState } from "react";
import { StorageGitHubConnectorForm } from "../forms/StorageGitHubConnectorForm";
import { StorageGitLabConnectorForm } from "../forms/StorageGitLabConnectorForm";

const connectors = [
    {
        id: "github",
        name: "GitHub",
        icon: "simple-icons:github",
        color: "text-[#f5f5f5]",
    },
    {
        id: "gitlab",
        name: "GitLab",
        icon: "simple-icons:gitlab",
        color: "text-[#fc6d26]",
    },
];

export const StorageConnectorsSelectPanel = () => {
    const [selectedConnectorId, setSelectedConnectorId] = useState(
        connectors[0]?.id || "",
    );
    const selectedConnector =
        connectors.find((connector) => connector.id === selectedConnectorId) ||
        connectors[0];

    const renderConnectorForm = () => {
        if (selectedConnectorId === "gitlab") {
            return <StorageGitLabConnectorForm />;
        }

        return <StorageGitHubConnectorForm />;
    };

    return (
        <section className="flex h-full">
            <aside className="border-b border-main-600/55 p-4 w-1/5 border-r">
                {connectors.map((connector) => (
                    <button
                        key={connector.id}
                        type="button"
                        onClick={() => setSelectedConnectorId(connector.id)}
                        className={`group relative mb-3 w-full overflow-hidden rounded-2xl px-3 py-1.5 text-left transition-all duration-200 ease-out animate-card-rise-in cursor-pointer ${
                            selectedConnectorId === connector.id
                                ? "bg-main-700/70"
                                : "hover:border-main-500/60 hover:bg-main-700/60"
                        }`}
                    >
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-main-300/15 bg-main-900/75">
                                <Icon
                                    icon={connector.icon}
                                    width={21}
                                    height={21}
                                    className={connector.color}
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-base text-main-100">
                                    {connector.name}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </aside>
            <div className="w-full flex-1 p-4 animate-panel-slide-in">
                <div className="mb-2 flex items-center gap-2 text-main-100">
                    <Icon
                        icon={selectedConnector.icon}
                        width={18}
                        height={18}
                        className={selectedConnector.color}
                    />
                    <h3 className="text-lg font-semibold">
                        {selectedConnector.name}
                    </h3>
                </div>
                <p className="text-sm text-main-300">
                    Выберите действие для подключения и синхронизации данных.
                </p>

                <div className="mt-5 border-t border-main-700/70 pt-5">
                    {renderConnectorForm()}
                </div>
            </div>
        </section>
    );
};
