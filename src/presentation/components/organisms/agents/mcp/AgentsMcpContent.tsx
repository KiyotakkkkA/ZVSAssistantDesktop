import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { McpServerMock, McpServerStatus } from "../mockData";

type AgentsMcpContentProps = {
    selectedServer: McpServerMock | null;
    isSubmitting: boolean;
    onToggleStatus: () => void;
};

const statusStyles: Record<McpServerStatus, string> = {
    online: "bg-emerald-500/20 text-emerald-300",
    degraded: "bg-amber-500/20 text-amber-300",
    offline: "bg-rose-500/20 text-rose-300",
};

const statusLabels: Record<McpServerStatus, string> = {
    online: "Онлайн",
    degraded: "Сбои",
    offline: "Офлайн",
};

const getStatusButtonLabel = (status: McpServerStatus) => {
    if (status === "offline") {
        return "Подключить";
    }

    return "Сменить статус";
};

export const AgentsMcpContent = ({
    selectedServer,
    isSubmitting,
    onToggleStatus,
}: AgentsMcpContentProps) => {
    if (!selectedServer) {
        return (
            <div className="flex-1 p-4 animate-card-rise-in">
                <div className="flex h-full flex-col items-center justify-center gap-3">
                    <Icon
                        icon="mdi:server-network-off"
                        width={64}
                        height={64}
                        className="text-main-500"
                    />
                    <p className="text-sm text-main-300">
                        Выберите MCP сервер слева
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 animate-card-rise-in">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-base text-main-100">MCP контент</h3>
                    <p className="text-xs text-main-400">
                        {selectedServer.transport.toUpperCase()} •{" "}
                        {selectedServer.endpoint}
                    </p>
                </div>

                <Button
                    label={getStatusButtonLabel(selectedServer.status)}
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-3"
                    disabled={isSubmitting}
                    onClick={onToggleStatus}
                >
                    <Icon icon="mdi:power" />
                </Button>
            </div>

            <div className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h4 className="text-lg text-main-100">
                        {selectedServer.name}
                    </h4>
                    <span
                        className={`rounded-md px-2 py-1 text-xs ${statusStyles[selectedServer.status]}`}
                    >
                        {statusLabels[selectedServer.status]}
                    </span>
                </div>

                <p className="text-sm text-main-200 leading-relaxed">
                    {selectedServer.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-main-300">
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Транспорт: {selectedServer.transport.toUpperCase()}
                    </div>
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Задержка: {selectedServer.latencyMs} ms
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                    <p className="mb-2 text-xs text-main-400">
                        Подключенные инструменты
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selectedServer.tools.map((toolName) => (
                            <span
                                key={`${selectedServer.id}-${toolName}`}
                                className="rounded-md border border-main-700/80 bg-main-900/70 px-2 py-1 text-xs text-main-300"
                            >
                                {toolName}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
