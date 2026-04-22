import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { McpServerMock, McpServerStatus } from "../mockData";

type AgentsMcpSidebarProps = {
    isLoading: boolean;
    isSubmitting: boolean;
    searchQuery: string;
    servers: McpServerMock[];
    selectedServerId: string | null;
    onSearchQueryChange: (value: string) => void;
    onCreateServer: () => void;
    onFullRefresh: () => void;
    onSelectServer: (serverId: string) => void;
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

export const AgentsMcpSidebar = ({
    isLoading,
    isSubmitting,
    searchQuery,
    servers,
    selectedServerId,
    onSearchQueryChange,
    onCreateServer,
    onFullRefresh,
    onSelectServer,
}: AgentsMcpSidebarProps) => {
    return (
        <aside className="min-h-0 border-b border-main-600/55 w-1/5 border-r p-4">
            <InputSmall
                placeholder="Поиск MCP по имени или endpoint..."
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
            />

            <div className="mt-4 flex items-center gap-2 animate-card-rise-in">
                <Button
                    variant="primary"
                    className="w-full p-1 gap-2 flex-1"
                    shape="rounded-lg"
                    disabled={isSubmitting}
                    onClick={onCreateServer}
                >
                    <Icon
                        icon="mdi:plus-circle-outline"
                        width={22}
                        height={22}
                    />
                    Добавить MCP
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
                icon="mdi:server-network"
                label="MCP серверы"
                className="mt-5 animate-card-rise-in"
            />

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto animate-card-rise-in">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-main-300">
                        Загрузка серверов...
                    </div>
                ) : servers.length > 0 ? (
                    <div className="space-y-2">
                        {servers.map((server) => (
                            <button
                                key={server.id}
                                type="button"
                                onClick={() => {
                                    onSelectServer(server.id);
                                }}
                                className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                    server.id === selectedServerId
                                        ? "bg-main-600/70"
                                        : "bg-main-900/45 hover:bg-main-700/70"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-main-100">
                                            {server.name}
                                        </p>
                                        <p className="truncate text-[11px] text-main-400">
                                            {server.transport.toUpperCase()}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-main-300">
                                        {server.tools.length}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] ${statusStyles[server.status]}`}
                                    >
                                        {statusLabels[server.status]}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:server-off-outline"
                            width={48}
                            height={48}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            MCP серверы не найдены
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
