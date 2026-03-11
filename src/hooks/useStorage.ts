import { useEffect, useMemo } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { storageStore } from "../stores/storageStore";
import { readAccessTokenFromLocalStorage } from "../services/api/authTokens";
import type {
    ProxyHttpRequestPayload,
    VectorStorageRecord,
    VectorTagRecord,
} from "../types/ElectronApi";
import { Config } from "../config";

type StorageError = Error;

type ListVectorStoragesParams = {
    name?: string;
    tagIds?: string[];
};

type VectorStoragesApiResponse = {
    storages?: unknown[];
};

type VectorStorageTagsApiResponse = {
    tags?: unknown[];
};

const VECTOR_STORAGES_QUERY_KEY = ["vector-storages"] as const;
const VECTOR_STORAGE_TAGS_QUERY_KEY = ["vector-storage-tags"] as const;

const proxyHttpRequest = async ({
    url,
    method,
    headers,
    bodyText,
}: ProxyHttpRequestPayload): Promise<string> => {
    const api = window.appApi;

    if (api?.network?.proxyHttpRequest) {
        const result = await api.network.proxyHttpRequest({
            url,
            method,
            headers,
            bodyText,
        });

        if (!result.ok) {
            throw new Error(result.bodyText || result.statusText);
        }

        return result.bodyText;
    }

    const response = await fetch(url, {
        method,
        headers,
        ...(bodyText && method !== "GET" && method !== "HEAD"
            ? { body: bodyText }
            : {}),
    });

    const raw = await response.text();

    if (!response.ok) {
        throw new Error(raw || `Request failed with status ${response.status}`);
    }

    return raw;
};

const normalizeTag = (raw: unknown): VectorTagRecord | null => {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const source = raw as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";

    if (!id || !name) {
        return null;
    }

    return {
        id,
        name,
        createdAt:
            typeof source.createdAt === "string"
                ? source.createdAt
                : typeof source.created_at === "string"
                  ? source.created_at
                  : new Date(0).toISOString(),
        updatedAt:
            typeof source.updatedAt === "string"
                ? source.updatedAt
                : typeof source.updated_at === "string"
                  ? source.updated_at
                  : new Date(0).toISOString(),
    };
};

const normalizeVectorStorage = (raw: unknown): VectorStorageRecord | null => {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const source = raw as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";

    if (!id) {
        return null;
    }

    const tagsRaw = Array.isArray(source.tags) ? source.tags : [];
    const tags = tagsRaw
        .map((tag) => normalizeTag(tag))
        .filter((tag): tag is VectorTagRecord => Boolean(tag));

    const fileIdsRaw = Array.isArray(source.fileIds)
        ? source.fileIds
        : Array.isArray(source.file_ids)
          ? source.file_ids
          : [];

    const fileIds = fileIdsRaw.filter(
        (fileId): fileId is string => typeof fileId === "string",
    );

    return {
        id,
        name:
            typeof source.name === "string" && source.name.trim().length > 0
                ? source.name.trim()
                : id,
        size:
            typeof source.size === "number" && Number.isFinite(source.size)
                ? source.size
                : 0,
        lastActiveAt:
            typeof source.lastActiveAt === "string"
                ? source.lastActiveAt
                : typeof source.last_active_at === "string"
                  ? source.last_active_at
                  : new Date(0).toISOString(),
        createdAt:
            typeof source.createdAt === "string"
                ? source.createdAt
                : typeof source.created_at === "string"
                  ? source.created_at
                  : new Date(0).toISOString(),
        fileIds,
        tags,
        usedByProjects: [],
    };
};

const fetchVectorStorages = async (
    params?: ListVectorStoragesParams,
): Promise<VectorStorageRecord[]> => {
    const query = new URLSearchParams();
    const name = params?.name?.trim();

    if (name) {
        query.set("name", name);
    }

    if (params?.tagIds?.length) {
        for (const tagId of params.tagIds) {
            query.append("tagIds", tagId);
        }
    }

    const url = `${Config.ZVS_MAIN_BASE_URL}/api/vstorages${query.toString() ? `?${query.toString()}` : ""}`;
    const accessToken = readAccessTokenFromLocalStorage();
    const raw = await proxyHttpRequest({
        url,
        method: "GET",
        headers: accessToken
            ? {
                  Authorization: `Bearer ${accessToken}`,
              }
            : undefined,
    });
    const parsed = raw
        ? (JSON.parse(raw) as VectorStoragesApiResponse)
        : ({ storages: [] } as VectorStoragesApiResponse);

    const list = Array.isArray(parsed.storages) ? parsed.storages : [];

    return list
        .map((storage) => normalizeVectorStorage(storage))
        .filter((storage): storage is VectorStorageRecord => Boolean(storage));
};

const fetchVectorStorageTags = async (): Promise<VectorTagRecord[]> => {
    const accessToken = readAccessTokenFromLocalStorage();
    const raw = await proxyHttpRequest({
        url: `${Config.ZVS_MAIN_BASE_URL}/api/vstorages/tags`,
        method: "GET",
        headers: accessToken
            ? {
                  Authorization: `Bearer ${accessToken}`,
              }
            : undefined,
    });
    const parsed = raw
        ? (JSON.parse(raw) as VectorStorageTagsApiResponse)
        : ({ tags: [] } as VectorStorageTagsApiResponse);

    const list = Array.isArray(parsed.tags) ? parsed.tags : [];

    return list
        .map((tag) => normalizeTag(tag))
        .filter((tag): tag is VectorTagRecord => Boolean(tag));
};

export const useVectorStorages = (
    params?: ListVectorStoragesParams,
    options?: Omit<
        UseQueryOptions<
            VectorStorageRecord[],
            StorageError,
            VectorStorageRecord[],
            readonly [
                ...typeof VECTOR_STORAGES_QUERY_KEY,
                { name?: string; tagIds?: string[] },
            ]
        >,
        "queryKey" | "queryFn"
    >,
) => {
    const normalizedParams = useMemo(
        () => ({
            name: params?.name?.trim() || undefined,
            tagIds:
                params?.tagIds && params.tagIds.length > 0
                    ? [...params.tagIds].sort()
                    : undefined,
        }),
        [params?.name, params?.tagIds],
    );

    const query = useQuery<
        VectorStorageRecord[],
        StorageError,
        VectorStorageRecord[],
        readonly [
            ...typeof VECTOR_STORAGES_QUERY_KEY,
            { name?: string; tagIds?: string[] },
        ]
    >({
        queryKey: [...VECTOR_STORAGES_QUERY_KEY, normalizedParams],
        queryFn: () => fetchVectorStorages(normalizedParams),
        retry: false,
        ...options,
    });

    useEffect(() => {
        if (!query.data) {
            return;
        }

        storageStore.setVectorStoragesData(query.data);
    }, [query.data]);

    return query;
};

export const useVectorStorageTags = (
    options?: Omit<
        UseQueryOptions<
            VectorTagRecord[],
            StorageError,
            VectorTagRecord[],
            typeof VECTOR_STORAGE_TAGS_QUERY_KEY
        >,
        "queryKey" | "queryFn"
    >,
) => {
    const query = useQuery<
        VectorTagRecord[],
        StorageError,
        VectorTagRecord[],
        typeof VECTOR_STORAGE_TAGS_QUERY_KEY
    >({
        queryKey: VECTOR_STORAGE_TAGS_QUERY_KEY,
        queryFn: fetchVectorStorageTags,
        retry: false,
        ...options,
    });

    useEffect(() => {
        if (!query.data) {
            return;
        }

        storageStore.setVectorTagsData(query.data);
    }, [query.data]);

    return query;
};
