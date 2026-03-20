import { makeAutoObservable, runInAction } from "mobx";
import { ProfileBootPayload } from "../types/electron";

class ProfileStore {
    user: ProfileBootPayload["user"] | null = null;
    themes: ProfileBootPayload["themeData"]["list"] = [];
    currentTheme: ProfileBootPayload["themeData"]["current"] | null = null;

    isLoading = false;
    isBootstrapped = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    private applyThemePalette(palette: Record<string, string>) {
        const root = document.documentElement;

        for (const [cssVar, value] of Object.entries(palette)) {
            root.style.setProperty(cssVar, value);
        }
    }

    private hydrate(payload: ProfileBootPayload) {
        this.user = payload.user;
        this.themes = payload.themeData.list;
        this.currentTheme = payload.themeData.current;
        this.applyThemePalette(payload.themeData.current.palette);
    }

    async bootstrap() {
        if (!window.profile?.boot) {
            runInAction(() => {
                this.error = "Profile API is unavailable";
                this.isBootstrapped = true;
            });
            return;
        }

        runInAction(() => {
            this.isLoading = true;
            this.error = null;
        });

        try {
            const payload = await window.profile.boot();

            runInAction(() => {
                this.hydrate(payload);
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        } catch (error) {
            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to load profile";
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        }

        console.log("Profile bootstrapped");
        console.log("User:", this.user);
        console.log("Available themes:", this.themes);
        console.log("Current theme:", this.currentTheme);
    }

    async updateProfile(
        id: string,
        data: {
            generalData?: {
                name: string;
                preferredTheme: string;
                preferredLanguage: string;
                userPrompt: string;
            };
            secureData?: {
                ollamaApiKey: string;
            };
        },
    ) {
        if (!window.profile?.update) {
            throw new Error("Profile API is unavailable");
        }

        const payload = await window.profile.update(id, data);

        runInAction(() => {
            this.hydrate(payload);
            this.error = null;
        });
    }
}

export const profileStore = new ProfileStore();
