import { makeAutoObservable, runInAction, toJS } from "mobx";
import type { ProfileBootPayload } from "../../electron/models/profile";
import type {
    GeneralUserData,
    SecureUserData,
    UpdateUserDto,
} from "../../electron/models/user";

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
    }

    async updateProfile(id: string, data: UpdateUserDto) {
        console.log(data);
        const payload = await window.profile.update(id, data);

        runInAction(() => {
            this.hydrate(payload);
            this.error = null;
        });
    }

    updateGeneralData(nextData: Partial<GeneralUserData>) {
        if (!this.user) return;

        const currentGeneralData = toJS(this.user.generalData);

        void this.updateProfile(this.user.id, {
            generalData: {
                ...currentGeneralData,
                ...nextData,
            },
        });
    }

    updateSecureData(nextData: Partial<SecureUserData>) {
        if (!this.user) return;

        void this.updateProfile(this.user.id, {
            secureData: {
                ...this.user.secureData,
                ...nextData,
            },
        });
    }
}

export const profileStore = new ProfileStore();
