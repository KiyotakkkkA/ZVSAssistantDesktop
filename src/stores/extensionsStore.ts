import { makeAutoObservable, runInAction } from "mobx";
import type { AppExtensionInfo } from "../types/App";

class ExtensionsStore {
    isLoading = false;
    extensions: AppExtensionInfo[] = [];

    private isRefreshing = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    hydrateFromBootData(entries: AppExtensionInfo[]): void {
        this.extensions = [...entries];
    }

    async refresh(): Promise<void> {
        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;

        runInAction(() => {
            this.isLoading = true;
        });

        try {
            const api = window.appApi?.extensions;

            if (!api) {
                runInAction(() => {
                    this.extensions = [];
                });
                return;
            }

            const extensions = await api.getExtensionsState();

            runInAction(() => {
                this.extensions = extensions;
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
            this.isRefreshing = false;
        }
    }

    getById(extensionId: string): AppExtensionInfo | null {
        return (
            this.extensions.find((entry) => entry.id === extensionId) ?? null
        );
    }
}

export const extensionsStore = new ExtensionsStore();
