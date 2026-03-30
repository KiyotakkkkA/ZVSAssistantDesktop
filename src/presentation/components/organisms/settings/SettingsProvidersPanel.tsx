import { PrettyBR } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import {
    ProviderSelector,
    type ProviderSelectorOption,
    SettingsOllamaProviderFields,
} from "../../molecules/settings";
import type {
    AllowedProviders,
    ChatGenProviderConfig,
} from "../../../../../electron/models/user";
import { profileStore } from "../../../../stores/profileStore";

const providerOptions: ProviderSelectorOption[] = [
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

    if (!currentUser || !generalData) {
        return null;
    }

    const activeProvider = (generalData.chatGenProvider ??
        "ollama") as AllowedProviders;
    const activeProviderConfig: ChatGenProviderConfig = secureData
        ?.chatGenProviders?.[activeProvider] ?? {
        baseUrl: "",
        modelName: "",
        apiKey: "",
    };

    return (
        <div className="space-y-5 animate-page-fade-in">
            <PrettyBR icon="mdi:text" label="Генерация текста" size={20} />

            <div className="relative z-30 rounded-2xl bg-main-900/40 animate-card-rise-in space-y-4">
                <ProviderSelector
                    value={activeProvider}
                    onChange={(nextProvider) => {
                        profileStore.updateGeneralData({
                            chatGenProvider: nextProvider as AllowedProviders,
                        });
                    }}
                    options={providerOptions}
                    placeholder="Выберите провайдера"
                />

                {activeProvider === "ollama" ? (
                    <SettingsOllamaProviderFields
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
        </div>
    );
});
