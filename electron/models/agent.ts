export type Agent = {
    id: string;
    agentName: string;
    agentPrompt: string;
    agentToolsSet: string[];
    chatLabel: string;
    chatIcon: string;
    chatPlaceholder: string;
    isEditable: boolean;
    modelProvider: string;
    modelBaseUrl: string;
    modelName: string;
    modelApiKey: string;
};

export type AgentEntity = Agent & {
    created_at: string;
    updated_at: string;
};

export type CreateAgentDto = {
    agentName: string;
    agentPrompt: string;
    agentToolsSet: string[];
    chatLabel: string;
    chatIcon: string;
    chatPlaceholder: string;
    modelProvider?: string;
    modelBaseUrl?: string;
    modelName?: string;
    modelApiKey?: string;
};
