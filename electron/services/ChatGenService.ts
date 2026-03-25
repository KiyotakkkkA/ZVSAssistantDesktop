import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText, stepCountIs } from "ai";
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
import type { ToolsRuntimeService } from "./ToolsRuntimeService";

interface ChatFenServiceDeps {
    userRepository: UserRepository;
    toolsRuntimeService: ToolsRuntimeService;
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

const toMaxStepBudget = (maxToolsUsagePerResponse: number) => {
    const normalizedToolBudget = Math.max(1, maxToolsUsagePerResponse);

    return Math.max(8, normalizedToolBudget * 3);
};

export class ChatGenService {
    private readonly providerName = "ollama";
    private readonly baseURL = `${Config.OLLAMA_BASE_URL}/v1`;
    private readonly needUsage = true;

    private userRepository: UserRepository;
    private toolsRuntimeService: ToolsRuntimeService;

    constructor({ userRepository, toolsRuntimeService }: ChatFenServiceDeps) {
        this.userRepository = userRepository;
        this.toolsRuntimeService = toolsRuntimeService;
    }

    public streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        const currentUser = this.userRepository.findCurrentUser();
        const provider = createOpenAICompatible({
            name: this.providerName,
            baseURL: this.baseURL,
            apiKey: currentUser?.secureData.ollamaApiKey ?? "",
            includeUsage: this.needUsage,
        });

        const maxToolCalls = Math.max(
            1,
            currentUser?.generalData.maxToolsUsagePerResponse ?? 1,
        );
        const maxSteps = toMaxStepBudget(maxToolCalls);

        const tools = this.toolsRuntimeService.buildToolSet({
            dialogId: params.dialogId,
            packIds: params.toolPackIds,
            enabledToolNames: params.enabledToolNames,
        });

        const { fullStream, totalUsage } = streamText({
            model: (provider as OpenAICompatibleProvider)(params.model),
            messages: toModelMessages(params),
            tools,
            stopWhen: stepCountIs(maxSteps),
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
        const currentUser = this.userRepository.findCurrentUser();
        const provider = createOpenAICompatible({
            name: this.providerName,
            baseURL: this.baseURL,
            apiKey: currentUser?.secureData.ollamaApiKey ?? "",
            includeUsage: this.needUsage,
        });

        const maxToolCalls = Math.max(
            1,
            currentUser?.generalData.maxToolsUsagePerResponse ?? 1,
        );
        const maxSteps = toMaxStepBudget(maxToolCalls);

        const tools = this.toolsRuntimeService.buildToolSet({
            dialogId: params.dialogId,
            packIds: params.toolPackIds,
            enabledToolNames: params.enabledToolNames,
        });

        const { text, usage } = await generateText({
            model: (provider as OpenAICompatibleProvider)(params.model),
            messages: toModelMessages(params),
            tools,
            stopWhen: stepCountIs(maxSteps),
        });

        return {
            text,
            usage,
        };
    }
}
