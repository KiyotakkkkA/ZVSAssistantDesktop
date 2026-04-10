import { PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import {
    ProviderSelector,
    type ProviderSelectorOption,
    SettingsOllamaChatProviderFields,
    SettingsOllamaEmbeddingsProviderFields,
    SettingsOllamaWebProviderField,
    SettingsSearchapiWebProviderField,
} from "../../molecules/settings";
import type {
    AllowedEmbeddingsProviders,
    AllowedChatProviders,
    AllowedWebToolsProviders,
    ProviderConfig,
} from "../../../../../electron/models/user";
import { profileStore } from "../../../../stores/profileStore";
import { Config } from "../../../../../electron/config";

const providerOptions: ProviderSelectorOption[] = [
    {
        value: "ollama",
        label: "Ollama",
        logoIcon: "simple-icons:ollama",
        logoClassName: "text-main-200",
    },
];

const webProviderOptions: ProviderSelectorOption[] = [
    {
        value: "ollama",
        label: "Ollama",
        logoIcon: "simple-icons:ollama",
        logoClassName: "text-main-200",
    },
    {
        value: "searchapi",
        label: "SearchAPI",
        logoIcon: "mdi:magnify",
        logoClassName: "text-main-200",
    },
];

const embeddingsProviderOptions: ProviderSelectorOption[] = [
    {
        value: "ollama",
        label: "Ollama",
        logoIcon: "simple-icons:ollama",
        logoClassName: "text-main-200",
    },
];

export const SettingsProvidersPanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;
    const secureData = currentUser?.secureData;

    const activeProvider = (generalData?.chatGenProvider ??
        "ollama") as AllowedChatProviders;
    const activeProviderConfig: ProviderConfig = secureData?.chatGenProviders?.[
        activeProvider
    ] ?? {
        baseUrl: "",
        modelName: "",
        apiKey: "",
    };
    const activeWebProvider = (generalData?.webToolsProvider ??
        "ollama") as AllowedWebToolsProviders;
    const webToolsProviders = {
        ollama: {
            baseUrl:
                secureData?.webToolsProviders?.ollama?.baseUrl ??
                Config.OLLAMA_BASE_URL,
            apiKey: secureData?.webToolsProviders?.ollama?.apiKey ?? "",
        },
        searchapi: {
            apiKey: secureData?.webToolsProviders?.searchapi?.apiKey ?? "",
        },
    };
    const activeWebProviderConfig: ProviderConfig =
        webToolsProviders[activeWebProvider];
    const activeEmbeddingsProvider = (generalData?.embeddingsProvider ??
        "ollama") as AllowedEmbeddingsProviders;
    const embeddingsProviders = {
        ollama: {
            baseUrl:
                secureData?.embeddingsProviders?.ollama?.baseUrl ??
                Config.OLLAMA_BASE_URL,
            modelName:
                secureData?.embeddingsProviders?.ollama?.modelName ??
                "nomic-embed-text:latest",
            apiKey: secureData?.embeddingsProviders?.ollama?.apiKey ?? "",
        },
    };
    const activeEmbeddingsProviderConfig: ProviderConfig =
        embeddingsProviders[activeEmbeddingsProvider];

    return (
        <div className="space-y-5 animate-page-fade-in">
            <PrettyBR icon="mdi:text" label="Генерация текста" size={20} />

            <div className="relative rounded-2xl bg-main-900/40 animate-card-rise-in space-y-4">
                <ProviderSelector
                    value={activeProvider}
                    onChange={(nextProvider) => {
                        profileStore.updateGeneralData({
                            chatGenProvider:
                                nextProvider as AllowedChatProviders,
                        });
                    }}
                    options={providerOptions}
                    placeholder="Выберите провайдера"
                />

                {activeProvider === "ollama" ? (
                    <SettingsOllamaChatProviderFields
                        providerConfig={activeProviderConfig}
                        onChange={(nextConfig) => {
                            profileStore.updateSecureData({
                                chatGenProviders: {
                                    ...secureData?.chatGenProviders,
                                    [activeProvider]: nextConfig,
                                },
                            });
                        }}
                    />
                ) : null}
            </div>

            <PrettyBR icon="mdi:web" label="Поиск в интернете" size={20} />

            <div className="relative rounded-2xl bg-main-900/40 animate-card-rise-in space-y-4">
                <ProviderSelector
                    value={activeWebProvider}
                    onChange={(nextProvider) => {
                        profileStore.updateGeneralData({
                            webToolsProvider:
                                nextProvider as AllowedWebToolsProviders,
                        });
                    }}
                    options={webProviderOptions}
                    placeholder="Выберите провайдера"
                />

                {activeWebProvider === "ollama" ? (
                    <SettingsOllamaWebProviderField
                        providerConfig={activeWebProviderConfig}
                        onChange={(nextConfig) => {
                            profileStore.updateSecureData({
                                webToolsProviders: {
                                    ...webToolsProviders,
                                    [activeWebProvider]: nextConfig,
                                },
                            });
                        }}
                    />
                ) : null}

                {activeWebProvider === "searchapi" ? (
                    <SettingsSearchapiWebProviderField
                        providerConfig={activeWebProviderConfig}
                        onChange={(nextConfig) => {
                            profileStore.updateSecureData({
                                webToolsProviders: {
                                    ...webToolsProviders,
                                    [activeWebProvider]: nextConfig,
                                },
                            });
                        }}
                    />
                ) : null}
            </div>

            <PrettyBR
                icon="mdi:database-search"
                label="Создание эмбеддингов"
                size={20}
            />

            <div className="relative rounded-2xl bg-main-900/40 animate-card-rise-in space-y-4">
                <ProviderSelector
                    value={activeEmbeddingsProvider}
                    onChange={(nextProvider) => {
                        profileStore.updateGeneralData({
                            embeddingsProvider:
                                nextProvider as AllowedEmbeddingsProviders,
                        });
                    }}
                    options={embeddingsProviderOptions}
                    placeholder="Выберите провайдера"
                />

                {activeEmbeddingsProvider === "ollama" ? (
                    <SettingsOllamaEmbeddingsProviderFields
                        providerConfig={activeEmbeddingsProviderConfig}
                        onChange={(nextConfig) => {
                            profileStore.updateSecureData({
                                embeddingsProviders: {
                                    ...embeddingsProviders,
                                    [activeEmbeddingsProvider]: nextConfig,
                                },
                            });
                        }}
                    />
                ) : null}
            </div>
        </div>
    );
});
