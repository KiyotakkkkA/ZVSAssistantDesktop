export type AgentStatus = "active" | "paused" | "draft";
export type McpServerStatus = "online" | "offline" | "degraded";
export type ScenarioStatus = "ready" | "needs-config" | "disabled";

export type AgentMock = {
    id: string;
    name: string;
    role: string;
    model: string;
    status: AgentStatus;
    toolsCount: number;
    updatedAt: string;
    description: string;
    tags: string[];
};

export type McpServerMock = {
    id: string;
    name: string;
    status: McpServerStatus;
    transport: "stdio" | "http" | "websocket";
    endpoint: string;
    tools: string[];
    latencyMs: number;
    description: string;
};

export type ScenarioMock = {
    id: string;
    name: string;
    status: ScenarioStatus;
    trigger: string;
    owner: string;
    lastRun: string;
    description: string;
    steps: string[];
};

export const AGENTS_MOCK_DATA: AgentMock[] = [
    {
        id: "agent-code-review",
        name: "Code Review Pro",
        role: "Ревью кода и рекомендации",
        model: "gpt-5.3-codex",
        status: "active",
        toolsCount: 7,
        updatedAt: "сегодня, 12:40",
        description:
            "Проверяет pull request, находит баги и предлагает безопасные улучшения.",
        tags: ["review", "typescript", "quality"],
    },
    {
        id: "agent-release-notes",
        name: "Release Notes Writer",
        role: "Сборка changelog",
        model: "gpt-5.1-mini",
        status: "paused",
        toolsCount: 3,
        updatedAt: "вчера, 19:10",
        description:
            "Собирает изменения по коммитам и оформляет релизные заметки в нужном формате.",
        tags: ["docs", "release", "automation"],
    },
    {
        id: "agent-onboarding",
        name: "Onboarding Guide",
        role: "Помощник по адаптации",
        model: "gpt-4.1",
        status: "draft",
        toolsCount: 2,
        updatedAt: "2 дня назад",
        description:
            "Готовит персональный onboarding-план для новых участников команды.",
        tags: ["hr", "plan"],
    },
];

export const MCP_SERVERS_MOCK_DATA: McpServerMock[] = [
    {
        id: "mcp-files",
        name: "Filesystem MCP",
        status: "online",
        transport: "stdio",
        endpoint: "local://mcp/filesystem",
        tools: ["read_file", "write_file", "search"],
        latencyMs: 26,
        description:
            "Локальный доступ к файлам проекта и базовые операции с ними.",
    },
    {
        id: "mcp-github",
        name: "GitHub MCP",
        status: "degraded",
        transport: "http",
        endpoint: "https://mcp.internal.local/github",
        tools: ["list_prs", "get_diff", "create_comment"],
        latencyMs: 240,
        description:
            "Работа с pull request и review-комментариями через приватный шлюз.",
    },
    {
        id: "mcp-notion",
        name: "Notion MCP",
        status: "offline",
        transport: "websocket",
        endpoint: "wss://mcp.internal.local/notion",
        tools: ["list_pages", "append_block"],
        latencyMs: 0,
        description:
            "Синхронизация заметок и статусов с внутренним workspace Notion.",
    },
];

export const SCENARIOS_MOCK_DATA: ScenarioMock[] = [
    {
        id: "scenario-pr-review",
        name: "Ревью Pull Request",
        status: "ready",
        trigger: "Ручной запуск",
        owner: "Команда разработки",
        lastRun: "сегодня, 11:15",
        description:
            "Проверяет diff, запускает чек-лист качества и публикует итоговый отчёт.",
        steps: [
            "Получить изменения PR",
            "Проверить риски и регрессии",
            "Сформировать комментарий в PR",
        ],
    },
    {
        id: "scenario-release-digest",
        name: "Релизный дайджест",
        status: "needs-config",
        trigger: "Каждую пятницу в 18:00",
        owner: "Продуктовая команда",
        lastRun: "никогда",
        description:
            "Собирает изменения за неделю и формирует дайджест для команды и пользователей.",
        steps: [
            "Собрать merged PR",
            "Сгруппировать изменения по категориям",
            "Сформировать короткий релизный пост",
        ],
    },
    {
        id: "scenario-onboarding-check",
        name: "Онбординг сотрудника",
        status: "disabled",
        trigger: "Создание аккаунта в HR системе",
        owner: "HR",
        lastRun: "3 дня назад",
        description:
            "Создаёт персональный план адаптации и рассылает стартовые материалы.",
        steps: [
            "Собрать данные сотрудника",
            "Сгенерировать список задач на первую неделю",
            "Отправить материалы в рабочий чат",
        ],
    },
];
