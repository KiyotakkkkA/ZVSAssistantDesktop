import type { AgentEntity, CreateAgentDto } from "../models/agent";
import type { DatabaseService } from "../services/DatabaseService";

type RawAgentData = {
    id: string;
    agent_name: string;
    agent_prompt: string;
    agent_tools_set: string;
    chat_label: string;
    chat_icon: string;
    chat_placeholder: string;
    is_editable: number;
    model_provider: string;
    model_base_url: string;
    model_name: string;
    model_api_key: string;
    created_at: string;
    updated_at: string;
};

const parseTools = (value: string): string[] => {
    try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
            return parsed.filter((item): item is string => typeof item === "string");
        }
    } catch {
        return [];
    }

    return [];
};

const mapAgent = (row: RawAgentData): AgentEntity => ({
    id: row.id,
    agentName: row.agent_name,
    agentPrompt: row.agent_prompt,
    agentToolsSet: parseTools(row.agent_tools_set),
    chatLabel: row.chat_label,
    chatIcon: row.chat_icon,
    chatPlaceholder: row.chat_placeholder,
    isEditable: Boolean(row.is_editable),
    modelProvider: row.model_provider,
    modelBaseUrl: row.model_base_url,
    modelName: row.model_name,
    modelApiKey: row.model_api_key,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const normalizeText = (value: string | undefined, fallback = "") => {
    return value?.trim() || fallback;
};

export class AgentsRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll(): AgentEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM agents ORDER BY updated_at DESC")
            .all() as RawAgentData[];

        return rows.map(mapAgent);
    }

    createAgent(payload: CreateAgentDto): AgentEntity {
        const now = new Date().toISOString();
        const id = `agt-${crypto.randomUUID()}`;
        const agentName = normalizeText(payload.agentName, "Новый агент");
        const chatLabel = normalizeText(payload.chatLabel, agentName);

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO agents (
                    id,
                    agent_name,
                    agent_prompt,
                    agent_tools_set,
                    chat_label,
                    chat_icon,
                    chat_placeholder,
                    is_editable,
                    model_provider,
                    model_base_url,
                    model_name,
                    model_api_key,
                    created_at,
                    updated_at
                )
                VALUES (
                    @id,
                    @agent_name,
                    @agent_prompt,
                    @agent_tools_set,
                    @chat_label,
                    @chat_icon,
                    @chat_placeholder,
                    @is_editable,
                    @model_provider,
                    @model_base_url,
                    @model_name,
                    @model_api_key,
                    @created_at,
                    @updated_at
                )
                `,
            )
            .run({
                id,
                agent_name: agentName,
                agent_prompt: normalizeText(payload.agentPrompt),
                agent_tools_set: JSON.stringify(payload.agentToolsSet ?? []),
                chat_label: chatLabel,
                chat_icon: normalizeText(payload.chatIcon, "mdi:robot-outline"),
                chat_placeholder: normalizeText(
                    payload.chatPlaceholder,
                    "Поручите задачу агенту...",
                ),
                is_editable: 1,
                model_provider: normalizeText(payload.modelProvider),
                model_base_url: normalizeText(payload.modelBaseUrl),
                model_name: normalizeText(payload.modelName),
                model_api_key: normalizeText(payload.modelApiKey),
                created_at: now,
                updated_at: now,
            });

        const created = this.findById(id);

        if (!created) {
            throw new Error("Failed to create agent");
        }

        return created;
    }

    private findById(id: string): AgentEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM agents WHERE id = ? LIMIT 1")
            .get(id) as RawAgentData | undefined;

        return row ? mapAgent(row) : null;
    }
}
