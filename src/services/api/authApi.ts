import { Config } from "../../config";
import { userStore } from "../../stores/userStore";
import type { ProxyHttpRequestPayload } from "../../types/ElectronApi";
import {
    readAccessTokenFromLocalStorage,
    readRefreshTokenFromLocalStorage,
} from "./authTokens";
import type {
    AuthSessionResponse,
    AuthSessionsResponse,
    AuthUser,
    LoginBody,
    LogoutBody,
    RegisterBody,
} from "../../types/Auth";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
    method: HttpMethod;
    endpoint: string;
    data?: unknown;
    accessToken?: string;
    auth?: boolean;
    skipRefresh?: boolean;
};

type ApiErrorPayload = {
    message?: string;
    error?: string;
    statusCode?: number;
    [key: string]: unknown;
};

export class ApiError extends Error {
    status: number;
    payload?: ApiErrorPayload;

    constructor(status: number, message: string, payload?: ApiErrorPayload) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.payload = payload;
    }
}

type RawResponse = {
    status: number;
    statusText: string;
    bodyText: string;
};

const createJsonHeaders = (authToken?: string): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(authToken
        ? {
              Authorization: `Bearer ${authToken}`,
          }
        : {}),
});

const requestRaw = async ({
    method,
    endpoint,
    data,
    accessToken,
}: RequestOptions): Promise<RawResponse> => {
    const payload: ProxyHttpRequestPayload = {
        url: `${Config.ZVS_MAIN_BASE_URL}/api/auth/${endpoint}`,
        method,
        headers: createJsonHeaders(accessToken),
        ...(data !== undefined ? { bodyText: JSON.stringify(data) } : {}),
    };

    const appApi = window.appApi;

    if (appApi?.network?.proxyHttpRequest) {
        const result = await appApi.network.proxyHttpRequest(payload);
        return {
            status: result.status,
            statusText: result.statusText,
            bodyText: result.bodyText,
        };
    }

    const response = await fetch(payload.url, {
        method,
        headers: payload.headers,
        ...(payload.bodyText && method !== "GET"
            ? { body: payload.bodyText }
            : {}),
    });

    return {
        status: response.status,
        statusText: response.statusText,
        bodyText: await response.text(),
    };
};

const parseResponse = <T>(response: RawResponse): T => {
    const raw = response.bodyText;
    const payload = raw ? (JSON.parse(raw) as ApiErrorPayload) : undefined;

    if (response.status < 200 || response.status >= 300) {
        const message =
            typeof payload?.message === "string"
                ? payload.message
                : raw ||
                  response.statusText ||
                  `Request failed with status ${response.status}`;

        throw new ApiError(response.status, message, payload);
    }

    return (payload ?? ({} as ApiErrorPayload)) as T;
};

let refreshInFlight: Promise<string> | null = null;

const doRefresh = async (): Promise<string> => {
    const refreshToken = readRefreshTokenFromLocalStorage();

    if (!refreshToken) {
        throw new ApiError(401, "No refresh token found");
    }

    const response = await requestRaw({
        method: "POST",
        endpoint: "refresh",
        data: { refreshToken },
    });

    const session = parseResponse<AuthSessionResponse>(response);

    userStore.setSession(
        session.accessToken,
        session.refreshToken || refreshToken,
        session.user ?? userStore.user,
    );

    return session.accessToken;
};

const refreshAccessToken = async (): Promise<string> => {
    if (!refreshInFlight) {
        refreshInFlight = doRefresh().finally(() => {
            refreshInFlight = null;
        });
    }

    return refreshInFlight;
};

const request = async <T>(options: RequestOptions): Promise<T> => {
    const currentToken =
        options.accessToken ||
        (options.auth ? readAccessTokenFromLocalStorage() : "");

    const response = await requestRaw({
        ...options,
        accessToken: currentToken || undefined,
    });

    if (options.auth && response.status === 401 && !options.skipRefresh) {
        const nextToken = await refreshAccessToken();

        const retryResponse = await requestRaw({
            ...options,
            accessToken: nextToken,
            skipRefresh: true,
        });

        return parseResponse<T>(retryResponse);
    }

    return parseResponse<T>(response);
};

export const authApi = {
    register: (payload: RegisterBody) =>
        request<AuthSessionResponse>({
            method: "POST",
            endpoint: "register",
            data: payload,
        }),
    login: (payload: LoginBody) =>
        request<AuthSessionResponse>({
            method: "POST",
            endpoint: "login",
            data: payload,
        }),
    logout: (payload: LogoutBody) =>
        request<void>({
            method: "POST",
            endpoint: "logout",
            data: payload,
            auth: true,
        }),
    me: () =>
        request<AuthUser>({
            method: "GET",
            endpoint: "me",
            auth: true,
        }),
    sessions: () =>
        request<AuthSessionsResponse>({
            method: "GET",
            endpoint: "sessions",
            auth: true,
        }),
};
