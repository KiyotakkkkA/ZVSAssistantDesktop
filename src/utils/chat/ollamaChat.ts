import type { ChatMessage, OllamaMessage } from "../../types/Chat";

export const toOllamaMessages = (messages: ChatMessage[]): OllamaMessage[] =>
    messages
        .filter((message) => {
            const stage = message.assistantStage as
                | "thinking"
                | "planning"
                | "questioning"
                | "tools_calling"
                | "answering"
                | undefined;

            if (message.author === "assistant") {
                return stage === "answering" || !stage;
            }

            return message.author === "system" || message.author === "user";
        })
        .map((message) => ({
            role: message.author,
            content: message.content,
        }));
