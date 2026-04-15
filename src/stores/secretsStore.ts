import { action, makeAutoObservable, runInAction } from "mobx";
import type {
    CreateSecretDto,
    SecretEntity,
} from "../../electron/models/secret";

export type { SecretEntity };

class SecretsStore {
    secrets: SecretEntity[] = [];
    isLoading = false;
    isBootstrapped = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(
            this,
            {
                bootstrap: action.bound,
                getSecretsByType: action.bound,
                addSecret: action.bound,
                removeSecret: action.bound,
            },
            { autoBind: true },
        );
    }

    async bootstrap() {
        runInAction(() => {
            this.isLoading = true;
            this.error = null;
        });

        try {
            const secrets = await window.secrets.getSecrets();

            runInAction(() => {
                this.secrets = secrets;
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        } catch (error) {
            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to load secrets";
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        }
    }

    async addSecret(payload: CreateSecretDto) {
        const created = await window.secrets.createSecret(payload);

        runInAction(() => {
            this.secrets = [created, ...this.secrets];
            this.error = null;
        });
    }

    async getSecretsByType(type: string) {
        return window.secrets.getSecretsByType(type);
    }

    async removeSecret(id: string) {
        await window.secrets.deleteSecret(id);

        runInAction(() => {
            this.secrets = this.secrets.filter((item) => item.id !== id);
            this.error = null;
        });
    }
}

export const secretsStore = new SecretsStore();
