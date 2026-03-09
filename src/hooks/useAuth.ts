import {
    hasAuthTokensInLocalStorage,
    readRefreshTokenFromLocalStorage,
} from "../services/api/authTokens";
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
    type UseQueryOptions,
} from "@tanstack/react-query";
import { authApi } from "../services/api/authApi";
import { userProfileStore } from "../stores/userProfileStore";
import { userStore } from "../stores/userStore";
import type {
    AuthSession,
    AuthSessionResponse,
    AuthSessionsResponse,
    AuthUser,
    LoginBody,
    RegisterBody,
} from "../types/Auth";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;
export const AUTH_SESSIONS_QUERY_KEY = ["auth", "sessions"] as const;

type AuthError = Error;

type AuthMutationOptions<TPayload> = Omit<
    UseMutationOptions<AuthSessionResponse, AuthError, TPayload>,
    "mutationFn"
>;

export const useRegister = (options?: AuthMutationOptions<RegisterBody>) => {
    const queryClient = useQueryClient();
    const { onSuccess: externalOnSuccess, ...restOptions } = options ?? {};

    return useMutation<AuthSessionResponse, AuthError, RegisterBody>({
        mutationFn: authApi.register,
        ...restOptions,
        onSuccess: (data, variables, onMutateResult, context) => {
            userStore.setSession(
                data.accessToken,
                data.refreshToken,
                data.user ?? null,
            );

            if (data.user) {
                queryClient.setQueryData(AUTH_ME_QUERY_KEY, data.user);
            } else {
                void queryClient.invalidateQueries({
                    queryKey: AUTH_ME_QUERY_KEY,
                });
            }

            externalOnSuccess?.(data, variables, onMutateResult, context);
        },
    });
};

export const useLogin = (options?: AuthMutationOptions<LoginBody>) => {
    const queryClient = useQueryClient();
    const { onSuccess: externalOnSuccess, ...restOptions } = options ?? {};

    return useMutation<AuthSessionResponse, AuthError, LoginBody>({
        mutationFn: authApi.login,
        ...restOptions,
        onSuccess: (data, variables, onMutateResult, context) => {
            userStore.setSession(
                data.accessToken,
                data.refreshToken,
                data.user ?? null,
            );

            if (data.user) {
                queryClient.setQueryData(AUTH_ME_QUERY_KEY, data.user);
            } else {
                void queryClient.invalidateQueries({
                    queryKey: AUTH_ME_QUERY_KEY,
                });
            }

            externalOnSuccess?.(data, variables, onMutateResult, context);
        },
    });
};

type LogoutVariables = {
    refreshToken?: string;
};

export const useLogout = (
    options?: Omit<
        UseMutationOptions<void, AuthError, LogoutVariables>,
        "mutationFn"
    >,
) => {
    const queryClient = useQueryClient();
    const { onSuccess: externalOnSuccess, ...restOptions } = options ?? {};

    return useMutation<void, AuthError, LogoutVariables>({
        mutationFn: async (variables) => {
            const refreshToken =
                variables?.refreshToken ?? readRefreshTokenFromLocalStorage();

            if (!refreshToken) {
                throw new Error("No refresh token found for logout");
            }

            return authApi.logout({ refreshToken });
        },
        ...restOptions,
        onSuccess: (data, variables, onMutateResult, context) => {
            userStore.clearSession();
            queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
            externalOnSuccess?.(data, variables, onMutateResult, context);
        },
    });
};

export const useMe = (
    options?: Omit<
        UseQueryOptions<
            AuthUser,
            AuthError,
            AuthUser,
            typeof AUTH_ME_QUERY_KEY
        >,
        "queryKey" | "queryFn"
    >,
) => {
    const optionsEnabled = options?.enabled;

    return useQuery<AuthUser, AuthError, AuthUser, typeof AUTH_ME_QUERY_KEY>({
        queryKey: AUTH_ME_QUERY_KEY,
        queryFn: async () => {
            if (!hasAuthTokensInLocalStorage()) {
                throw new Error("No auth tokens found");
            }

            try {
                const me = await authApi.me();
                userStore.setUser(me);
                return me;
            } catch (error) {
                userStore.clearSession();
                await userProfileStore.updateUserProfile({
                    zvsAuthUserId: "",
                    zvsAuthLogin: "",
                    zvsAuthEmail: "",
                    zvsAuthName: "",
                    zvsAuthUpdatedAt: "",
                });
                throw error;
            }
        },
        enabled: optionsEnabled ?? hasAuthTokensInLocalStorage(),
        retry: false,
        ...options,
    });
};

export const useSessions = (
    options?: Omit<
        UseQueryOptions<
            AuthSessionsResponse,
            AuthError,
            AuthSession[],
            typeof AUTH_SESSIONS_QUERY_KEY
        >,
        "queryKey" | "queryFn" | "select"
    >,
) => {
    return useQuery<
        AuthSessionsResponse,
        AuthError,
        AuthSession[],
        typeof AUTH_SESSIONS_QUERY_KEY
    >({
        queryKey: AUTH_SESSIONS_QUERY_KEY,
        queryFn: () => authApi.sessions(),
        select: (data) => data.sessions,
        enabled: hasAuthTokensInLocalStorage(),
        retry: false,
        ...options,
    });
};
