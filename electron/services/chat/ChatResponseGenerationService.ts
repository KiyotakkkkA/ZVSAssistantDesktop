import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs, streamText } from "ai";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import type {
    AsyncIterableStream,
    LanguageModelUsage,
    TextStreamPart,
    ToolSet,
} from "ai";
import type { ResponseGenParams } from "../../models/chat";
import type { ToolsRuntimeService } from "../ToolsRuntimeService";
import { ChatModelMessagesService } from "./ChatModelMessagesService";
import { ChatProviderConfigService } from "./ChatProviderConfigService";

const toMaxStepBudget = (maxToolsUsagePerResponse: number) => {
    const normalizedToolBudget = Math.max(1, maxToolsUsagePerResponse);

    return Math.max(8, normalizedToolBudget * 3);
};

export class ChatResponseGenerationService {
    constructor(
        private readonly providerConfigService: ChatProviderConfigService,
        private readonly toolsRuntimeService: ToolsRuntimeService,
        private readonly modelMessagesService: ChatModelMessagesService,
        private readonly needUsage = true,
    ) {}

    streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        const currentUser = this.providerConfigService.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.providerConfigService.getSelectedProviderConfig(currentUser);
        const {
            providerName: webToolsProvider,
            providerConfig: webToolsProviderConfig,
        } =
            this.providerConfigService.getSelectedWebToolsProviderConfig(
                currentUser,
            );
        const provider = createOpenAICompatible({
            name: providerName,
            baseURL: `${providerConfig.baseUrl}/v1`,
            apiKey: providerConfig.apiKey,
            includeUsage: this.needUsage,
        });

        const maxToolCalls = Math.max(
            1,
            currentUser.generalData.maxToolsUsagePerResponse ?? 1,
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
            messages: this.modelMessagesService.toModelMessages(params),
            tools,
            stopWhen: stepCountIs(maxSteps),
        });

        return {
            fullStream,
            getTotalUsage: async () => await totalUsage,
        };
    }

    async generateResponse(params: ResponseGenParams): Promise<{
        text: string;
        usage: LanguageModelUsage;
    }> {
        const currentUser = this.providerConfigService.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.providerConfigService.getSelectedProviderConfig(currentUser);
        const {
            providerName: webToolsProvider,
            providerConfig: webToolsProviderConfig,
        } =
            this.providerConfigService.getSelectedWebToolsProviderConfig(
                currentUser,
            );
        const provider = createOpenAICompatible({
            name: providerName,
            baseURL: `${providerConfig.baseUrl}/v1`,
            apiKey: providerConfig.apiKey,
            includeUsage: this.needUsage,
        });

        const maxToolCalls = Math.max(
            1,
            currentUser.generalData.maxToolsUsagePerResponse ?? 1,
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
            messages: this.modelMessagesService.toModelMessages(params),
            tools,
            stopWhen: stepCountIs(maxSteps),
        });

        return {
            text,
            usage,
        };
    }
}
