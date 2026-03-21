export type ChatRole = "user" | "assistant";

export type ChatRequestMessage = {
    role: ChatRole;
    content: string;
};

export type ResponseGenParams = {
    prompt?: string;
    model: string;
    messages?: ChatRequestMessage[];
};
