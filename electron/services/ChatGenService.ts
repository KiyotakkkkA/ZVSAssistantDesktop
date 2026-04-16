import fs from "node:fs";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText, stepCountIs, embedMany } from "ai";
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
    VecstoreSearchResult,
} from "../models/chat";
import type {
    AllowedEmbeddingsProviders,
    AllowedChatProviders,
    AllowedWebToolsProviders,
    ProviderConfig,
    User,
} from "../models/user";
import type { UserRepository } from "../repositories/UserRepository";
import type { StorageVecstoresRepository } from "../repositories/storage/StorageVecstoresRepository";
import type { ToolsRuntimeService } from "./ToolsRuntimeService";
import { Config } from "../config";

interface ChatFenServiceDeps {
    userRepository: UserRepository;
    toolsRuntimeService: ToolsRuntimeService;
    storageVecstoresRepository: StorageVecstoresRepository;
}

type LanceDbConnection = {
    openTable?: (name: string) => Promise<unknown>;
};

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
    private storageVecstoresRepository: StorageVecstoresRepository;

    constructor({
        userRepository,
        toolsRuntimeService,
        storageVecstoresRepository,
    }: ChatFenServiceDeps) {
        this.userRepository = userRepository;
        this.toolsRuntimeService = toolsRuntimeService;
        this.storageVecstoresRepository = storageVecstoresRepository;
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

    private getSelectedEmbeddingsProviderConfig(currentUser: User): {
        providerName: AllowedEmbeddingsProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.embeddingsProvider ??
            "ollama") as AllowedEmbeddingsProviders;
        const providerConfig =
            currentUser.secureData.embeddingsProviders?.[providerName];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            throw new Error("Embeddings provider is not configured");
        }

        return {
            providerName,
            providerConfig,
        };
    }

    public async createEmbedding(value: string): Promise<number[]> {
        const normalized = value.trim();

        if (!normalized) {
            return [];
        }

        const [embedding] = await this.createEmbeddings([normalized]);

        return embedding ?? [];
    }

    public async createEmbeddings(values: string[]): Promise<number[][]> {
        const normalizedValues = values
            .map((value) => value.trim())
            .filter(Boolean);

        if (normalizedValues.length === 0) {
            return [];
        }

        const currentUser = this.getCurrentUserOrThrow();
        const { providerName, providerConfig } =
            this.getSelectedEmbeddingsProviderConfig(currentUser);
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

    public async getVecstoreResult(
        query: string,
        maxResults: number,
        confidencePercentage: number,
    ): Promise<VecstoreSearchResult[]> {
        const normalizedQuery = query.trim();

        if (!normalizedQuery) {
            return [];
        }

        const normalizedMaxResults = this.normalizeMaxResults(maxResults);
        const minConfidencePercentage =
            this.normalizeConfidencePercentage(confidencePercentage);
        const queryEmbedding = await this.createEmbedding(normalizedQuery);

        if (queryEmbedding.length === 0) {
            return [];
        }

        const vecstores = this.storageVecstoresRepository.findAll();

        if (vecstores.length === 0) {
            return [];
        }

        const results: VecstoreSearchResult[] = [];

        for (const vecstore of vecstores) {
            if (!fs.existsSync(vecstore.path)) {
                continue;
            }

            let db: LanceDbConnection;

            try {
                db = await this.connectLance(vecstore.path);
            } catch {
                continue;
            }

            const table = await this.openLanceTable(db, "chunks");

            if (!table) {
                continue;
            }

            const rows = await this.searchRowsInTable(
                table,
                queryEmbedding,
                normalizedMaxResults,
            );

            for (const row of rows) {
                const content = this.readString(row["content"]);
                const filePath = this.readString(
                    row["file_path"] ?? row["filePath"],
                );
                const fileId = this.readString(row["file_id"] ?? row["fileId"]);
                const chunkIndex = this.readNumber(
                    row["chunk_index"] ?? row["chunkIndex"],
                );

                if (!content || !filePath || !fileId || chunkIndex === null) {
                    continue;
                }

                const currentConfidencePercentage =
                    this.resolveConfidencePercentage(row);

                if (currentConfidencePercentage < minConfidencePercentage) {
                    continue;
                }

                results.push({
                    vecstoreId: vecstore.id,
                    vecstoreName: vecstore.name,
                    fileId,
                    filePath,
                    chunkIndex,
                    content,
                    confidencePercentage: Number(
                        currentConfidencePercentage.toFixed(2),
                    ),
                });
            }
        }

        return results
            .sort(
                (left, right) =>
                    right.confidencePercentage - left.confidencePercentage,
            )
            .slice(0, normalizedMaxResults);
    }

    private normalizeMaxResults(maxResults: number): number {
        if (!Number.isFinite(maxResults)) {
            return 5;
        }

        return Math.min(Math.max(Math.floor(maxResults), 1), 50);
    }

    private normalizeConfidencePercentage(
        confidencePercentage: number,
    ): number {
        if (!Number.isFinite(confidencePercentage)) {
            return 0;
        }

        return Math.min(Math.max(confidencePercentage, 0), 100);
    }

    private async connectLance(
        vecstorePath: string,
    ): Promise<LanceDbConnection> {
        const lancedbModule = (await import("@lancedb/lancedb")) as {
            connect?: (uri: string) => Promise<unknown>;
            default?: { connect?: (uri: string) => Promise<unknown> };
        };

        const connect = lancedbModule.connect ?? lancedbModule.default?.connect;

        if (!connect) {
            throw new Error("LanceDB connect() is unavailable");
        }

        return (await connect(vecstorePath)) as LanceDbConnection;
    }

    private async openLanceTable(
        db: LanceDbConnection,
        tableName: string,
    ): Promise<unknown | null> {
        if (typeof db.openTable !== "function") {
            return null;
        }

        try {
            return await db.openTable(tableName);
        } catch {
            return null;
        }
    }

    private async searchRowsInTable(
        table: unknown,
        embedding: number[],
        maxResults: number,
    ): Promise<Record<string, unknown>[]> {
        if (!this.hasFunction(table, "search")) {
            return [];
        }

        const searchCursor = table.search(embedding);

        if (!searchCursor) {
            return [];
        }

        const limitedCursor = this.hasFunction(searchCursor, "limit")
            ? searchCursor.limit(maxResults)
            : searchCursor;

        return await this.resolveRowsFromCursor(limitedCursor);
    }

    private async resolveRowsFromCursor(
        cursor: unknown,
    ): Promise<Record<string, unknown>[]> {
        const resolvedCursor = await Promise.resolve(cursor);

        if (Array.isArray(resolvedCursor)) {
            return resolvedCursor.filter((row) => this.isRecord(row));
        }

        if (this.hasFunction(resolvedCursor, "toArray")) {
            const rows = await resolvedCursor.toArray();

            return Array.isArray(rows)
                ? rows.filter((row) => this.isRecord(row))
                : [];
        }

        if (this.hasFunction(resolvedCursor, "execute")) {
            const rows = await resolvedCursor.execute();

            return Array.isArray(rows)
                ? rows.filter((row) => this.isRecord(row))
                : [];
        }

        return [];
    }

    private resolveConfidencePercentage(row: Record<string, unknown>): number {
        const explicitConfidence = this.readNumber(
            row["confidencePercentage"] ?? row["confidence_percentage"],
        );

        if (explicitConfidence !== null) {
            return this.normalizeConfidencePercentage(explicitConfidence);
        }

        const similarityScore = this.readNumber(
            row["_score"] ?? row["score"] ?? row["similarity"],
        );

        if (similarityScore !== null) {
            if (similarityScore >= 0 && similarityScore <= 1) {
                return Number((similarityScore * 100).toFixed(2));
            }

            return this.normalizeConfidencePercentage(similarityScore);
        }

        const distance = this.readNumber(
            row["_distance"] ?? row["distance"] ?? row["dist"],
        );

        if (distance !== null) {
            const normalizedDistance = Math.max(distance, 0);
            const percentage = 100 / (1 + normalizedDistance);

            return Number(
                this.normalizeConfidencePercentage(percentage).toFixed(2),
            );
        }

        return 0;
    }

    private readString(value: unknown): string | null {
        if (typeof value !== "string") {
            return null;
        }

        const normalized = value.trim();
        return normalized ? normalized : null;
    }

    private readNumber(value: unknown): number | null {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }

    private hasFunction(
        value: unknown,
        name: string,
    ): value is Record<string, (...args: unknown[]) => unknown> {
        return this.isRecord(value) && typeof value[name] === "function";
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
