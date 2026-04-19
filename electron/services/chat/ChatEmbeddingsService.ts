import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { embedMany } from "ai";
import type { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { ChatProviderConfigService } from "./ChatProviderConfigService";

export class ChatEmbeddingsService {
    constructor(
        private readonly providerConfigService: ChatProviderConfigService,
    ) {}

    async createEmbedding(value: string): Promise<number[]> {
        const normalized = value.trim();

        if (!normalized) {
            return [];
        }

        const [embedding] = await this.createEmbeddings([normalized]);

        return embedding ?? [];
    }

    async createEmbeddings(values: string[]): Promise<number[][]> {
        const normalizedValues = values
            .map((value) => value.trim())
            .filter(Boolean);

        if (normalizedValues.length === 0) {
            return [];
        }

        const currentUser = this.providerConfigService.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.providerConfigService.getSelectedEmbeddingsProviderConfig(
                currentUser,
            );
        const provider = createOpenAICompatible({
            name: providerName,
            baseURL: `${providerConfig.baseUrl}/v1`,
            apiKey: providerConfig.apiKey,
        });

        const { embeddings } = await embedMany({
            model: (provider as OpenAICompatibleProvider).embeddingModel(
                providerConfig.modelName ?? "",
            ),
            values: normalizedValues,
        });

        return embeddings;
    }
}
