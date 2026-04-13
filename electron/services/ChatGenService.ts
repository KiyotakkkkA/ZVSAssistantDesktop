import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText, stepCountIs } from "ai";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type {
    AsyncIterableStream,
    LanguageModelUsage,
    ModelMessage,
    TextStreamPart,
    ToolSet,
} from "ai";
import type {
    ChatRequestContentPart,
    ChatRequestMessage,
    ResponseGenParams,
} from "../models/chat";
import type {
    AllowedChatProviders,
    AllowedWebToolsProviders,
    ProviderConfig,
    User,
} from "../models/user";
import type { UserRepository } from "../repositories/UserRepository";
import type { ToolsRuntimeService } from "./ToolsRuntimeService";
import { Config } from "../config";

interface ChatFenServiceDeps {
    userRepository: UserRepository;
    toolsRuntimeService: ToolsRuntimeService;
}

const getTextFromParts = (parts: ChatRequestContentPart[]) => {
    return parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
};

const toUserContentParts = (parts: ChatRequestContentPart[]) => {
    return parts.map((part) => {
        if (part.type === "text") {
            return {
                type: "text" as const,
                text: part.text,
            };
        }

        return {
            type: "image" as const,
            image: part.image,
            mediaType: part.mediaType,
        };
    });
};

const toModelMessage = (message: ChatRequestMessage): ModelMessage => {
    if (message.role === "user") {
        return {
            role: "user",
            content: toUserContentParts(message.content),
        };
    }

    return {
        role: message.role,
        content: getTextFromParts(message.content),
    };
};

const toModelMessages = (params: ResponseGenParams): ModelMessage[] => {
    if (params.messages && params.messages.length > 0) {
        return params.messages.map(toModelMessage);
    }

    return [
        {
            role: "user" as const,
            content: [
                {
                    type: "text" as const,
                    text: params.prompt ?? "",
                },
            ],
        },
    ];
};

const toMaxStepBudget = (maxToolsUsagePerResponse: number) => {
    const normalizedToolBudget = Math.max(1, maxToolsUsagePerResponse);

    return Math.max(8, normalizedToolBudget * 3);
};

export class ChatGenService {
    private readonly needUsage = true;

    private userRepository: UserRepository;
    private toolsRuntimeService: ToolsRuntimeService;

    constructor({ userRepository, toolsRuntimeService }: ChatFenServiceDeps) {
        this.userRepository = userRepository;
        this.toolsRuntimeService = toolsRuntimeService;
    }

    private getCurrentUserOrThrow(): User {
        const currentUser = this.userRepository.findCurrentUser();

        if (!currentUser) {
            throw new Error("Current user is not found");
        }

        return currentUser;
    }

    private getSelectedProviderConfig(currentUser: User): {
        providerName: AllowedChatProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.chatGenProvider ??
            "ollama") as AllowedChatProviders;
        const providerConfig =
            currentUser.secureData.chatGenProviders?.[providerName];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            throw new Error("Text generation provider is not configured");
        }

        return {
            providerName,
            providerConfig,
        };
    }

    private getSelectedWebToolsProviderConfig(currentUser: User): {
        providerName: AllowedWebToolsProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.webToolsProvider ??
            "ollama") as AllowedWebToolsProviders;
        const rawProviderConfig =
            currentUser.secureData.webToolsProviders?.[providerName] ??
            (providerName === "ollama"
                ? {
                      baseUrl: Config.OLLAMA_BASE_URL,
                      apiKey: "",
                  }
                : {
                      apiKey: "",
                  });

        const providerConfig: ProviderConfig =
            providerName === "ollama"
                ? {
                      ...rawProviderConfig,
                      baseUrl:
                          rawProviderConfig.baseUrl ?? Config.OLLAMA_BASE_URL,
                  }
                : rawProviderConfig;

        return {
            providerName,
            providerConfig,
        };
    }

    public streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        const currentUser = this.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.getSelectedProviderConfig(currentUser);
        const {
            providerName: webToolsProvider,
            providerConfig: webToolsProviderConfig,
        } = this.getSelectedWebToolsProviderConfig(currentUser);
        const provider = createOpenAICompatible({
            name: providerName,
            baseURL: `${providerConfig.baseUrl}/v1`,
            apiKey: providerConfig.apiKey,
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
            webToolsProvider,
            providerBaseUrl: webToolsProviderConfig.baseUrl,
            providerApiKey: webToolsProviderConfig.apiKey,
        });

        const { fullStream, totalUsage } = streamText({
            model: (provider as OpenAICompatibleProvider)(
                providerConfig.modelName ?? "",
            ),
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
        const currentUser = this.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.getSelectedProviderConfig(currentUser);
        const {
            providerName: webToolsProvider,
            providerConfig: webToolsProviderConfig,
        } = this.getSelectedWebToolsProviderConfig(currentUser);
        const provider = createOpenAICompatible({
            name: providerName,
            baseURL: `${providerConfig.baseUrl}/v1`,
            apiKey: providerConfig.apiKey,
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
            webToolsProvider,
            providerBaseUrl: webToolsProviderConfig.baseUrl,
            providerApiKey: webToolsProviderConfig.apiKey,
        });

        const { text, usage } = await generateText({
            model: (provider as OpenAICompatibleProvider)(
                providerConfig.modelName ?? "",
            ),
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
