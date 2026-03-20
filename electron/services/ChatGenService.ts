import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText } from "ai";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type {
    AsyncIterableStream,
    LanguageModelUsage,
    TextStreamPart,
    ToolSet,
} from "ai";

export type ResponseGenParams = {
    prompt?: string;
    model: string;
    messages?: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
};

const toModelMessages = (params: ResponseGenParams) => {
    if (params.messages && params.messages.length > 0) {
        return params.messages;
    }

    return [
        {
            role: "user" as const,
            content: params.prompt ?? "",
        },
    ];
};

export class ChatGenService {
    private provider: OpenAICompatibleProvider | undefined;

    private readonly providerName = "ollama";
    private readonly baseURL = "https://ollama.com/v1";
    private readonly needUsage = true;

    constructor(token: string) {
        this.rebuildProvider(token);
    }

    public rebuildProvider(token: string) {
        this.provider = createOpenAICompatible({
            name: this.providerName,
            baseURL: this.baseURL,
            apiKey: token,
            includeUsage: this.needUsage,
        });
    }

    public streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        const { fullStream, totalUsage } = streamText({
            model: (this.provider as OpenAICompatibleProvider)(params.model),
            messages: toModelMessages(params),
        });

        return {
            fullStream,
            getTotalUsage: async () => await totalUsage,
        };
    }

    public async generateResponse(params: ResponseGenParams): Promise<{
        text: string;
        usage: LanguageModelUsage;
    }> {
        const { text, usage } = await generateText({
            model: (this.provider as OpenAICompatibleProvider)(params.model),
            messages: toModelMessages(params),
        });

        return {
            text,
            usage,
        };
    }
}
