import type {
    AllowedChatProviders,
    AllowedEmbeddingsProviders,
    AllowedWebToolsProviders,
    ProviderConfig,
    User,
} from "../../models/user";
import type { UserRepository } from "../../repositories/UserRepository";
import { Config } from "../../config";

export class ChatProviderConfigService {
    constructor(private readonly userRepository: UserRepository) {}

    getCurrentUserOrThrow(): User {
        const currentUser = this.userRepository.findCurrentUser();

        if (!currentUser) {
            throw new Error("Current user is not found");
        }

        return currentUser;
    }

    getSelectedProviderConfig(currentUser: User): {
        providerName: AllowedChatProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.chatGenProvider ??
            "ollama") as AllowedChatProviders;
        const providerConfig =
            currentUser.secureData.chatGenProviders?.[providerName];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            throw new Error("Text generation provider is not configured");
        }

        return {
            providerName,
            providerConfig,
        };
    }

    getSelectedWebToolsProviderConfig(currentUser: User): {
        providerName: AllowedWebToolsProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.webToolsProvider ??
            "ollama") as AllowedWebToolsProviders;
        const rawProviderConfig =
            currentUser.secureData.webToolsProviders?.[providerName] ??
            (providerName === "ollama"
                ? {
                      baseUrl: Config.OLLAMA_BASE_URL,
                      apiKey: "",
                  }
                : {
                      apiKey: "",
                  });

        const providerConfig: ProviderConfig =
            providerName === "ollama"
                ? {
                      ...rawProviderConfig,
                      baseUrl:
                          rawProviderConfig.baseUrl ?? Config.OLLAMA_BASE_URL,
                  }
                : rawProviderConfig;

        return {
            providerName,
            providerConfig,
        };
    }

    getSelectedEmbeddingsProviderConfig(currentUser: User): {
        providerName: AllowedEmbeddingsProviders;
        providerConfig: ProviderConfig;
    } {
        const providerName = (currentUser.generalData.embeddingsProvider ??
            "ollama") as AllowedEmbeddingsProviders;
        const providerConfig =
            currentUser.secureData.embeddingsProviders?.[providerName];

        if (!providerConfig?.baseUrl || !providerConfig?.modelName) {
            throw new Error("Embeddings provider is not configured");
        }

        return {
            providerName,
            providerConfig,
        };
    }
}
