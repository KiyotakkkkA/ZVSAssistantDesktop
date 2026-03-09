export type VectorSearchPayload = {
    query: string;
    topK?: number;
};

export type VectorSearchItem = {
    id: string;
    document: string;
    metadata_json?: string;
    distance?: number;
};

export type VectorSearchResponse = {
    success?: boolean;
    message?: string;
    items?: VectorSearchItem[];
};

export type VectorSearchHit = {
    id: string;
    text: string;
    score: number;
};

export const clampVectorSearchLimit = (
    value: unknown,
    fallback = 5,
): number => {
    const source = typeof value === "number" ? value : fallback;
    return Math.max(1, Math.min(10, Math.floor(source)));
};

export const buildVectorStorageSearchUrl = (
    baseUrl: string,
    vectorStorageId: string,
): string => {
    return `${baseUrl}/api/vstorages/${encodeURIComponent(vectorStorageId)}/search`;
};

export const normalizeVectorSearchResponse = (
    raw: string,
): VectorSearchResponse => {
    const parsed = raw
        ? (JSON.parse(raw) as VectorSearchResponse)
        : ({ items: [] } as VectorSearchResponse);

    const items = Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
              id: String(item.id || ""),
              document: String(item.document || ""),
              metadata_json:
                  typeof item.metadata_json === "string"
                      ? item.metadata_json
                      : undefined,
              distance:
                  typeof item.distance === "number" ? item.distance : undefined,
          }))
        : [];

    return {
        success: parsed.success,
        message: parsed.message,
        items,
    };
};

export const toVectorSearchHits = (
    items: VectorSearchItem[],
): VectorSearchHit[] => {
    return items.map((item) => ({
        id: String(item.id || ""),
        text: String(item.document || ""),
        score: typeof item.distance === "number" ? item.distance : Number.NaN,
    }));
};
