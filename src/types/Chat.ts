export type MessageRole = "system" | "user" | "assistant";
export type OllamaRole = MessageRole | "tool";

export type AssistantStage =
    | "thinking"
    | "planning"
    | "questioning"
    | "tools_calling"
    | "answering";

export type QaToolQuestionState = {
    id: string;
    question: string;
    reason?: string;
    selectAnswers?: string[];
    userAnswerHint?: string;
    answer?: string;
};

export type QaToolState = {
    activeQuestionIndex?: number;
    questions: QaToolQuestionState[];
};

export type ToolTrace = {
    callId: string;
    docId?: string;
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    status?: "pending" | "accepted" | "cancelled" | "answered" | "failed";
    qaState?: QaToolState;
    command?: string;
    cwd?: string;
    isAdmin?: boolean;
    confirmationTitle?: string;
    confirmationPrompt?: string;
};

export type ToolConfirmationSpec = {
    title: string;
    prompt: string;
};

export type TokenUsage = {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalSpentTokens?: number;
    contextWindow?: {
        system: number;
        systemInstructions: number;
        toolDefinitions: number;
        reservedOutput: number;
        userContext: number;
        messages: number;
        toolResults: number;
    };
};

export type ChatMessage = {
    id: string;
    author: MessageRole;
    content: string;
    timestamp: string;
    answeringAt?: string;
    assistantStage?: AssistantStage;
    toolTrace?: ToolTrace;
    hidden?: boolean;
};

export type ChatDialog = {
    id: string;
    title: string;
    messages: ChatMessage[];
    tokenUsage?: TokenUsage;
    forProjectId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ChatDialogListItem = {
    id: string;
    title: string;
    preview: string;
    time: string;
    updatedAt: string;
    tokenUsage?: TokenUsage;
};

export type DeleteDialogResult = {
    dialogs: ChatDialogListItem[];
    activeDialog: ChatDialog;
};

export type DialogMessagePayload = {
    dialogId: string;
    messageId: string;
};

export interface OllamaMessage {
    role: OllamaRole;
    content: string;
    tool_calls?: OllamaToolCall[];
    tool_name?: string;
    thinking?: string;
}

export type ToolParameterSchema = {
    type: string;
    description?: string;
    enum?: string[];
    properties?: Record<string, ToolParameterSchema>;
    items?: ToolParameterSchema;
    required?: string[];
};

export type OllamaToolDefinition = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: ToolParameterSchema;
    };
};

export type BuiltinToolDescriptor = {
    packageId: string;
    packageTitle: string;
    packageDescription: string;
    schema: OllamaToolDefinition;
    outputScheme?: Record<string, unknown>;
    confirmation?: ToolConfirmationSpec;
};

export type BuiltinToolPackage = {
    id: string;
    title: string;
    description: string;
    tools: BuiltinToolDescriptor[];
};

export type OllamaResponseFormat = "json" | Record<string, unknown>;

export type OllamaToolCall = {
    type?: "function";
    function: {
        index?: number;
        name: string;
        arguments: Record<string, unknown>;
    };
};

export interface OllamaChatChunk {
    model?: string;
    created_at?: string;
    message?: {
        role?: OllamaRole;
        content?: string;
        thinking?: string;
        tool_calls?: OllamaToolCall[];
    };
    done: boolean;
    error?: string;
    prompt_eval_count?: number;
    eval_count?: number;
}

export interface StreamChatParams {
    model: string;
    token?: string;
    messages: OllamaMessage[];
    tools?: OllamaToolDefinition[];
    format?: OllamaResponseFormat;
    signal?: AbortSignal;
    onChunk?: (chunk: OllamaChatChunk) => void;
}
