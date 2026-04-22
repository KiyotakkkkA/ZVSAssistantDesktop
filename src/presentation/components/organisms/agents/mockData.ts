export type McpServerStatus = "online" | "offline" | "degraded";
export type ScenarioStatus = "ready" | "needs-config" | "disabled";

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
