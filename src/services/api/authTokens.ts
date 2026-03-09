const ACCESS_TOKEN_KEY = "zvs.auth.accessToken";
const REFRESH_TOKEN_KEY = "zvs.auth.refreshToken";

const readToken = (key: string): string => {
    try {
        return window.localStorage.getItem(key)?.trim() ?? "";
    } catch {
        return "";
    }
};

export const readAccessTokenFromLocalStorage = (): string => {
    return readToken(ACCESS_TOKEN_KEY);
};

export const readRefreshTokenFromLocalStorage = (): string => {
    return readToken(REFRESH_TOKEN_KEY);
};

export const hasAuthTokensInLocalStorage = (): boolean => {
    return Boolean(
        readAccessTokenFromLocalStorage() || readRefreshTokenFromLocalStorage(),
    );
};
