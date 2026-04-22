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
