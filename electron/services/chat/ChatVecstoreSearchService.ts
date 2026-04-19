import fs from "node:fs";
import type { VecstoreSearchResult } from "../../models/chat";
import type { StorageVecstoresRepository } from "../../repositories/storage/StorageVecstoresRepository";
import { ChatEmbeddingsService } from "./ChatEmbeddingsService";

type LanceDbConnection = {
    openTable?: (name: string) => Promise<unknown>;
};

export class ChatVecstoreSearchService {
    constructor(
        private readonly embeddingsService: Pick<
            ChatEmbeddingsService,
            "createEmbedding"
        >,
        private readonly storageVecstoresRepository: StorageVecstoresRepository,
    ) {}

    async getVecstoreResult(
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
        const queryEmbedding =
            await this.embeddingsService.createEmbedding(normalizedQuery);

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
}
