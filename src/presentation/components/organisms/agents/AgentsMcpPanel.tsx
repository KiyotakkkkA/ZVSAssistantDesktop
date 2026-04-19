import { useEffect, useMemo, useState } from "react";
import { MCP_SERVERS_MOCK_DATA } from "./mockData";
import type { McpServerMock, McpServerStatus } from "./mockData";
import { AgentsMcpContent } from "./mcp/AgentsMcpContent";
import { AgentsMcpSidebar } from "./mcp/AgentsMcpSidebar";

const getNextMcpStatus = (status: McpServerStatus): McpServerStatus => {
    if (status === "online") {
        return "degraded";
    }

    if (status === "degraded") {
        return "offline";
    }

    return "online";
};

export const AgentsMcpPanel = () => {
    const [servers, setServers] = useState<McpServerMock[]>(
        MCP_SERVERS_MOCK_DATA,
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedServerId, setSelectedServerId] = useState<string | null>(
        MCP_SERVERS_MOCK_DATA[0]?.id ?? null,
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredServers = useMemo(() => {
        if (!normalizedQuery) {
            return servers;
        }

        return servers.filter(
            (server) =>
                server.name.toLowerCase().includes(normalizedQuery) ||
                server.endpoint.toLowerCase().includes(normalizedQuery) ||
                server.transport.toLowerCase().includes(normalizedQuery),
        );
    }, [normalizedQuery, servers]);

    const selectedServer =
        servers.find((server) => server.id === selectedServerId) ?? null;

    useEffect(() => {
        if (
            !selectedServerId ||
            servers.some((item) => item.id === selectedServerId)
        ) {
            return;
        }

        setSelectedServerId(servers[0]?.id ?? null);
    }, [servers, selectedServerId]);

    const handleCreateServer = () => {
        const nextIndex = servers.length + 1;
        const nextServer: McpServerMock = {
            id: `mcp-demo-${nextIndex}`,
            name: `Demo MCP ${nextIndex}`,
            status: "offline",
            transport: "http",
            endpoint: `https://demo.local/mcp/${nextIndex}`,
            tools: ["ping", "healthcheck"],
            latencyMs: 0,
            description: "Новый демонстрационный MCP-сервер.",
        };

        setServers((prev) => [nextServer, ...prev]);
        setSelectedServerId(nextServer.id);
    };

    const handleFullRefresh = () => {
        setServers((prev) =>
            prev.map((server) => {
                if (server.status === "online") {
                    return {
                        ...server,
                        latencyMs: Math.max(8, server.latencyMs - 8),
                    };
                }

                if (server.status === "degraded") {
                    return {
                        ...server,
                        latencyMs: server.latencyMs + 20,
                    };
                }

                return server;
            }),
        );
    };

    const handleToggleServerStatus = () => {
        if (!selectedServer) {
            return;
        }

        setServers((prev) =>
            prev.map((server) => {
                if (server.id !== selectedServer.id) {
                    return server;
                }

                const nextStatus = getNextMcpStatus(server.status);

                return {
                    ...server,
                    status: nextStatus,
                    latencyMs:
                        nextStatus === "offline" ? 0 : server.latencyMs || 35,
                };
            }),
        );
    };

    return (
        <section className="flex h-full min-h-0">
            <AgentsMcpSidebar
                isLoading={false}
                isSubmitting={false}
                searchQuery={searchQuery}
                servers={filteredServers}
                selectedServerId={selectedServer?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateServer={handleCreateServer}
                onFullRefresh={handleFullRefresh}
                onSelectServer={setSelectedServerId}
            />
            <AgentsMcpContent
                selectedServer={selectedServer}
                isSubmitting={false}
                onToggleStatus={handleToggleServerStatus}
            />
        </section>
    );
};
