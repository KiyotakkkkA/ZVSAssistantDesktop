import { useState } from "react";
import {
    Button,
    InputSmall,
    Modal,
    PrettyBR,
} from "@kiyotakkkka/zvs-uikit-lib";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { SettingsChatOllamaModelsPickForm } from "./forms/SettingsChatOllamaModelsPickForm";
import { Config } from "../../../../../electron/config";
import { profileStore } from "../../../../stores/profileStore";

export const SettingsProvidersPanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;
    const secureData = currentUser?.secureData;
    const [isModelsPickOpen, setIsModelsPickOpen] = useState(false);

    if (!currentUser || !generalData) {
        return null;
    }

    const modelBase = generalData.ollamaModel.split(":")[0];

    return (
        <div className="space-y-5 animate-page-fade-in">
            <PrettyBR icon="mdi:text" label="Генерация текста" size={20} />

            <div className="rounded-2xl bg-main-900/40 animate-card-rise-in">
                <div className="flex gap-2 items-center">
                    <Icon
                        icon="mdi:chip"
                        width={20}
                        height={20}
                        className="text-main-300"
                    />
                    <h4 className="text-sm font-semibold text-main-100">
                        Интеграция с Ollama
                    </h4>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Модель
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={generalData.ollamaModel}
                                    className="w-full"
                                    onChange={(event) =>
                                        profileStore.updateGeneralData({
                                            ollamaModel: event.target.value,
                                        })
                                    }
                                    placeholder="gpt-oss:20b"
                                />
                            </div>
                            <Button
                                variant="primary"
                                shape="rounded-lg"
                                className="h-9 shrink-0 px-3 text-xs"
                                onClick={() => setIsModelsPickOpen(true)}
                            >
                                Список
                            </Button>
                            <Link
                                to={`${Config.OLLAMA_BASE_URL}/library/${modelBase}`}
                                target="_blank"
                                className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-1 text-xs"
                            >
                                <Icon
                                    icon="mdi:open-in-new"
                                    width={18}
                                    height={18}
                                />
                                На страницу
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Token
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={secureData?.ollamaApiKey}
                                    onChange={(event) =>
                                        profileStore.updateSecureData({
                                            ollamaApiKey: event.target.value,
                                        })
                                    }
                                    placeholder="Token"
                                    type="password"
                                />
                            </div>
                            <Link
                                to={`${Config.OLLAMA_BASE_URL}/settings/keys`}
                                target="_blank"
                                className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-all duration-200 hover:-translate-y-0.5 flex items-center gap-1 text-xs"
                            >
                                <Icon
                                    icon="mdi:open-in-new"
                                    width={18}
                                    height={18}
                                />
                                Получить ключ
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={isModelsPickOpen}
                onClose={() => setIsModelsPickOpen(false)}
                title="Выбор Ollama-модели"
                className="max-w-6xl min-h-144"
            >
                <SettingsChatOllamaModelsPickForm
                    currentModel={generalData.ollamaModel}
                    onSelectModel={(modelName) => {
                        profileStore.updateGeneralData({
                            ollamaModel: modelName,
                        });
                    }}
                    onClose={() => setIsModelsPickOpen(false)}
                />
            </Modal>
        </div>
    );
});
