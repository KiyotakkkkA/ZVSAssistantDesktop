import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText } from "ai";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type {
    AsyncIterableStream,
    LanguageModelUsage,
    TextStreamPart,
    ToolSet,
} from "ai";
import { Config } from "../config";
import type { ResponseGenParams } from "../models/chat";
import type { UserRepository } from "../repositories/UserRepository";

interface ChatFenServiceDeps {
    userRepository: UserRepository;
}

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
    private readonly providerName = "ollama";
    private readonly baseURL = `${Config.OLLAMA_BASE_URL}/v1`;
    private readonly needUsage = true;

    private userRepository: UserRepository;

    constructor({ userRepository }: ChatFenServiceDeps) {
        this.userRepository = userRepository;
    }

    public streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        const provider = createOpenAICompatible({
            name: this.providerName,
            baseURL: this.baseURL,
            apiKey:
                this.userRepository.findCurrentUser()?.secureData
                    .ollamaApiKey ?? "",
            includeUsage: this.needUsage,
        });

        const { fullStream, totalUsage } = streamText({
            model: (provider as OpenAICompatibleProvider)(params.model),
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
        const provider = createOpenAICompatible({
            name: this.providerName,
            baseURL: this.baseURL,
            apiKey:
                this.userRepository.findCurrentUser()?.secureData
                    .ollamaApiKey ?? "",
            includeUsage: this.needUsage,
        });

        const { text, usage } = await generateText({
            model: (provider as OpenAICompatibleProvider)(params.model),
            messages: toModelMessages(params),
        });

        return {
            text,
            usage,
        };
    }
}
