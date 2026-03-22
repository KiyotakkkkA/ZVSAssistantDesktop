export type ChatRole = "user" | "assistant" | "system";

export type ChatRequestMessage = {
    role: ChatRole;
    content: string;
};

export type ResponseGenParams = {
    prompt?: string;
    model: string;
    messages?: ChatRequestMessage[];
    dialogId?: string;
    toolPackIds?: string[];
};
