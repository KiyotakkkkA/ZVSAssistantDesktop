import type { ChatMessage, OllamaResponseFormat } from "./Chat";
import type { OllamaToolDefinition } from "./Chat";
import type { TokenUsage } from "./Chat";

export type ChatAdapterRequest = {
    history: ChatMessage[];
    tools?: OllamaToolDefinition[];
    maxToolCalls?: number;
    format?: OllamaResponseFormat;
    executeTool?: (
        toolName: string,
        args: Record<string, unknown>,
        meta: { callId: string },
    ) => Promise<unknown>;
    onToolCall?: (payload: {
        callId: string;
        toolName: string;
        args: Record<string, unknown>;
    }) => void;
    onToolResult?: (payload: {
        callId: string;
        toolName: string;
        args: Record<string, unknown>;
        result: unknown;
    }) => void;
    onThinkingChunk?: (chunkText: string, done: boolean) => void;
    onUsage?: (usage: TokenUsage) => void;
    signal?: AbortSignal;
    onChunk: (chunkText: string, done: boolean) => void;
};

export type ChatProviderAdapter = {
    send: (request: ChatAdapterRequest) => Promise<void>;
};
