import { useState } from "react";
import { Button, InputSmall, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { Icon } from "@iconify/react";
import { SettingsChatOllamaModelsPickForm } from "../../../../organisms/settings/forms/SettingsChatOllamaModelsPickForm";
import type { ProviderConfig } from "../../../../../../../electron/models/user";
import { Config } from "../../../../../../../electron/config";

type SettingsOllamaEmbeddingsProviderFieldsProps = {
    providerConfig: ProviderConfig;
    onChange: (nextConfig: ProviderConfig) => void;
};

export function SettingsOllamaEmbeddingsProviderFields({
    providerConfig,
    onChange,
}: SettingsOllamaEmbeddingsProviderFieldsProps) {
    const [isModelsPickOpen, setIsModelsPickOpen] = useState(false);

    const baseUrl = providerConfig.baseUrl ?? "";
    const modelName = providerConfig.modelName ?? "";
    const apiKey = providerConfig.apiKey;
    const modelBase = modelName.split(":")[0];
    const canUseLinks = Boolean(baseUrl);

    return (
        <>
            <div className="space-y-2">
                <p className="text-sm font-medium text-main-200">Базовый URL</p>
                <InputSmall
                    value={baseUrl}
                    onChange={(event) =>
                        onChange({
                            ...providerConfig,
                            baseUrl: event.target.value,
                        })
                    }
                    placeholder={Config.OLLAMA_BASE_URL}
                    className="w-full"
                />
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium text-main-200">Модель</p>
                <div className="flex items-center gap-2 w-full">
                    <div className="flex-1">
                        <InputSmall
                            value={modelName}
                            className="w-full"
                            onChange={(event) =>
                                onChange({
                                    ...providerConfig,
                                    modelName: event.target.value,
                                })
                            }
                            placeholder="nomic-embed-text:latest"
                        />
                    </div>
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 shrink-0 px-3 text-xs"
                        onClick={() => setIsModelsPickOpen(true)}
                        disabled={!canUseLinks}
                    >
                        Список
                    </Button>
                    <a
                        href={
                            canUseLinks
                                ? `${baseUrl}/library/${modelBase}`
                                : "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-md p-2 text-white transition-all duration-200 flex items-center gap-1 text-xs ${
                            canUseLinks
                                ? "bg-indigo-700 hover:bg-indigo-800 hover:-translate-y-0.5"
                                : "bg-main-700/70 pointer-events-none"
                        }`}
                    >
                        <Icon icon="mdi:open-in-new" width={18} height={18} />
                        На страницу
                    </a>
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium text-main-200">Token</p>
                <div className="flex items-center gap-2 w-full">
                    <div className="flex-1">
                        <InputSmall
                            value={apiKey}
                            onChange={(event) =>
                                onChange({
                                    ...providerConfig,
                                    apiKey: event.target.value,
                                })
                            }
                            placeholder="Token"
                            type="password"
                        />
                    </div>
                    <a
                        href={canUseLinks ? `${baseUrl}/settings/keys` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-md p-2 text-white transition-all duration-200 flex items-center gap-1 text-xs ${
                            canUseLinks
                                ? "bg-indigo-700 hover:bg-indigo-800 hover:-translate-y-0.5"
                                : "bg-main-700/70 pointer-events-none"
                        }`}
                    >
                        <Icon icon="mdi:open-in-new" width={18} height={18} />
                        Получить ключ
                    </a>
                </div>
            </div>

            <Modal
                open={isModelsPickOpen}
                onClose={() => setIsModelsPickOpen(false)}
                title="Выбор Ollama-модели"
                className="max-w-6xl min-h-144"
            >
                <SettingsChatOllamaModelsPickForm
                    baseUrl={baseUrl}
                    currentModel={modelName}
                    onSelectModel={(nextModelName) => {
                        onChange({
                            ...providerConfig,
                            modelName: nextModelName,
                        });
                    }}
                    onClose={() => setIsModelsPickOpen(false)}
                />
            </Modal>
        </>
    );
}
