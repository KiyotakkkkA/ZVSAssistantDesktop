import { makeAutoObservable } from "mobx";
import type { AuthUser } from "../types/Auth";

const ACCESS_TOKEN_KEY = "zvs.auth.accessToken";
const REFRESH_TOKEN_KEY = "zvs.auth.refreshToken";

const safeGetItem = (key: string): string => {
    try {
        return window.localStorage.getItem(key) ?? "";
    } catch {
        return "";
    }
};

const safeSetItem = (key: string, value: string): void => {
    try {
        if (value) {
            window.localStorage.setItem(key, value);
            return;
        }

        window.localStorage.removeItem(key);
    } catch {
        // Ignore localStorage failures in restricted environments.
    }
};

class UserStore {
    accessToken = "";
    refreshToken = "";
    user: AuthUser | null = null;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
        this.accessToken = safeGetItem(ACCESS_TOKEN_KEY);
        this.refreshToken = safeGetItem(REFRESH_TOKEN_KEY);
    }

    setSession(
        accessToken: string,
        refreshToken: string,
        user: AuthUser | null,
    ): void {
        this.accessToken = accessToken.trim();
        this.refreshToken = refreshToken.trim();
        this.user = user;

        safeSetItem(ACCESS_TOKEN_KEY, this.accessToken);
        safeSetItem(REFRESH_TOKEN_KEY, this.refreshToken);
    }

    setUser(user: AuthUser | null): void {
        this.user = user;
    }

    clearSession(): void {
        this.accessToken = "";
        this.refreshToken = "";
        this.user = null;

        safeSetItem(ACCESS_TOKEN_KEY, "");
        safeSetItem(REFRESH_TOKEN_KEY, "");
    }
}

export const userStore = new UserStore();
