import type {
    AsyncIterableStream,
    LanguageModelUsage,
    TextStreamPart,
    ToolSet,
} from "ai";
import type { ResponseGenParams, VecstoreSearchResult } from "../models/chat";
import { ChatEmbeddingsService } from "./chat/ChatEmbeddingsService";
import { ChatResponseGenerationService } from "./chat/ChatResponseGenerationService";
import { ChatVecstoreSearchService } from "./chat/ChatVecstoreSearchService";

export class ChatGenService {
    constructor(
        private readonly embeddingsService: ChatEmbeddingsService,
        private readonly vecstoreSearchService: ChatVecstoreSearchService,
        private readonly responseGenerationService: ChatResponseGenerationService,
    ) {}

    public async createEmbedding(value: string): Promise<number[]> {
        return await this.embeddingsService.createEmbedding(value);
    }

    public async createEmbeddings(values: string[]): Promise<number[][]> {
        return await this.embeddingsService.createEmbeddings(values);
    }

    public async getVecstoreResult(
        query: string,
        maxResults: number,
        confidencePercentage: number,
    ): Promise<VecstoreSearchResult[]> {
        return await this.vecstoreSearchService.getVecstoreResult(
            query,
            maxResults,
            confidencePercentage,
        );
    }

    public streamResponseGeneration(params: ResponseGenParams): {
        fullStream: AsyncIterableStream<TextStreamPart<ToolSet>>;
        getTotalUsage: () => PromiseLike<LanguageModelUsage>;
    } {
        return this.responseGenerationService.streamResponseGeneration(params);
    }

    public async generateResponse(params: ResponseGenParams): Promise<{
        text: string;
        usage: LanguageModelUsage;
    }> {
        return await this.responseGenerationService.generateResponse(params);
    }
}
