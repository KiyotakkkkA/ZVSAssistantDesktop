import { useState } from "react";
import {
    Button,
    InputCheckbox,
    InputPath,
    InputSmall,
    Modal,
    PrettyBR,
} from "../../atoms";
import { Icon } from "@iconify/react";
import { useChatParams, useExtensions } from "../../../../hooks";
import { SettingsChatOllamaModelsPickForm } from "../forms";
import { Link, useNavigate } from "react-router-dom";

export const SettingsChatPanel = () => {
    const [isModelsPickOpen, setIsModelsPickOpen] = useState(false);
    const [isMissingPiperModalOpen, setIsMissingPiperModalOpen] =
        useState(false);
    const navigate = useNavigate();

    const { userProfile, updateChatParams } = useChatParams();
    const { getExtensionById, refreshExtensions } = useExtensions();

    const {
        chatDriver,
        ollamaModel,
        ollamaEmbeddingModel,
        ollamaToken,
        mistralVoiceRecModel,
        mistralToken,
        voiceRecognitionDriver,
        embeddingDriver,
        telegramId,
        telegramBotToken,
        assistantName,
        maxToolCallsPerResponse,
        useSpeechSynthesis,
        piperModelPath,
    } = userProfile;

    const handleSpeechSynthesisToggle = async (checked: boolean) => {
        if (!checked) {
            await updateChatParams({
                useSpeechSynthesis: false,
            });
            return;
        }

        let piperExtension = getExtensionById("piper");

        if (!piperExtension) {
            await refreshExtensions();
            piperExtension = getExtensionById("piper");
        }

        if (!piperExtension?.isInstalled) {
            setIsMissingPiperModalOpen(true);
            return;
        }

        await updateChatParams({
            useSpeechSynthesis: true,
        });
    };

    return (
        <div className="gap-5">
            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="flex gap-2 items-center">
                    <Icon
                        icon="mdi:robot"
                        width={20}
                        height={20}
                        className="text-main-300"
                    />
                    <h4 className="text-sm font-semibold text-main-100">
                        Ассистент
                    </h4>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Имя ассистента
                        </p>
                        <InputSmall
                            value={assistantName}
                            onChange={(event) =>
                                void updateChatParams({
                                    assistantName: event.target.value,
                                })
                            }
                            placeholder="Чарли"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Макс. кол-во вызовов инструментов за ответ
                        </p>
                        <InputSmall
                            value={String(maxToolCallsPerResponse)}
                            onChange={(event) => {
                                const raw = Number(event.target.value);
                                if (!Number.isFinite(raw)) {
                                    void updateChatParams({
                                        maxToolCallsPerResponse: 1,
                                    });
                                    return;
                                }

                                const nextValue = Math.max(1, Math.floor(raw));
                                void updateChatParams({
                                    maxToolCallsPerResponse: nextValue,
                                });
                            }}
                            placeholder="4"
                            type="number"
                            min={1}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:account-voice"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${useSpeechSynthesis ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Использовать для синтеза речи
                                </p>
                                <p className="text-xs text-main-400">Piper</p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={useSpeechSynthesis}
                            onChange={(checked) => {
                                void handleSpeechSynthesisToggle(checked);
                            }}
                        />
                    </div>

                    {useSpeechSynthesis ? (
                        <InputPath
                            label="Путь к модели Piper"
                            helperText="Выберите директорию, где находится модель (.onnx) и конфиг (.onnx.json)."
                            value={piperModelPath}
                            forFolders
                            placeholder="Директория модели не выбрана"
                            onChange={(nextPath) => {
                                void updateChatParams({
                                    piperModelPath: nextPath,
                                });
                            }}
                        />
                    ) : null}
                </div>
            </div>

            <PrettyBR icon="mdi:chip" label="ИИ Сервисы" size={20} />

            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="flex gap-2 items-center">
                    <Icon
                        icon="mdi:alpha-m-circle-outline"
                        width={20}
                        height={20}
                        className="text-main-300"
                    />
                    <h4 className="text-sm font-semibold text-main-100">
                        Интеграция с Mistral
                    </h4>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:microphone"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${voiceRecognitionDriver === "mistral" ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Использовать для распознавания голоса
                                </p>
                                <p className="text-xs text-main-400">Mistral</p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={voiceRecognitionDriver === "mistral"}
                            onChange={(checked) => {
                                void updateChatParams({
                                    voiceRecognitionDriver: checked
                                        ? "mistral"
                                        : "",
                                });
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Модель распознавания голоса
                        </p>
                        <InputSmall
                            value={mistralVoiceRecModel}
                            onChange={(event) =>
                                void updateChatParams({
                                    mistralVoiceRecModel: event.target.value,
                                })
                            }
                            placeholder="voxtral-mini-transcribe-realtime-2602"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Token
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={mistralToken}
                                    onChange={(event) =>
                                        void updateChatParams({
                                            mistralToken: event.target.value,
                                        })
                                    }
                                    placeholder="MISTRAL_API_KEY"
                                    type="password"
                                    className="w-full"
                                />
                            </div>
                            <Link
                                to="https://console.mistral.ai/build/audio/realtime?workspace_dialog=apiKeys"
                                target="_blank"
                                className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-colors"
                            >
                                <Icon
                                    icon="mdi:open-in-new"
                                    width={18}
                                    height={18}
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl bg-main-900/40 p-5">
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
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:chat-processing"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${chatDriver === "ollama" ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Использовать для общения
                                </p>
                                <p className="text-xs text-main-400">Ollama</p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={chatDriver === "ollama"}
                            onChange={(checked) => {
                                void updateChatParams({
                                    chatDriver: checked ? "ollama" : "",
                                });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:numbers"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${embeddingDriver === "ollama" ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Использовать для создания эмбеддингов
                                </p>
                                <p className="text-xs text-main-400">Ollama</p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={embeddingDriver === "ollama"}
                            onChange={(checked) => {
                                void updateChatParams({
                                    embeddingDriver: checked ? "ollama" : "",
                                });
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Модель
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={ollamaModel}
                                    className="w-full"
                                    readOnly
                                    placeholder="gpt-oss:20b"
                                />
                            </div>
                            <Button
                                variant="primary"
                                shape="rounded-lg"
                                className="h-9 shrink-0 px-3"
                                onClick={() => setIsModelsPickOpen(true)}
                            >
                                Выбрать
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Эмбеддинг-модель
                        </p>
                        <InputSmall
                            value={ollamaEmbeddingModel}
                            onChange={(event) =>
                                void updateChatParams({
                                    ollamaEmbeddingModel: event.target.value,
                                })
                            }
                            placeholder="embeddinggemma"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Token
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={ollamaToken}
                                    onChange={(event) =>
                                        void updateChatParams({
                                            ollamaToken: event.target.value,
                                        })
                                    }
                                    placeholder="Bearer token"
                                    type="password"
                                />
                            </div>
                            <Link
                                to="https://ollama.com/settings/keys"
                                target="_blank"
                                className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-colors"
                            >
                                <Icon
                                    icon="mdi:open-in-new"
                                    width={18}
                                    height={18}
                                />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <PrettyBR icon="mdi:link-variant" label="Прочие интеграции" />

            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="flex gap-2 items-center">
                    <Icon
                        icon="mdi:telegram"
                        width={20}
                        height={20}
                        className="text-main-300"
                    />
                    <h4 className="text-sm font-semibold text-main-100">
                        Интеграция с Telegram
                    </h4>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            ID Пользователя
                        </p>
                        <InputSmall
                            value={telegramId}
                            onChange={(event) =>
                                void updateChatParams({
                                    telegramId: event.target.value,
                                })
                            }
                            placeholder="123456789"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Bot token
                        </p>
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                                <InputSmall
                                    value={telegramBotToken}
                                    onChange={(event) =>
                                        void updateChatParams({
                                            telegramBotToken:
                                                event.target.value,
                                        })
                                    }
                                    placeholder="123456789:AA..."
                                    type="password"
                                />
                            </div>
                            <Link
                                to="https://t.me/BotFather"
                                target="_blank"
                                className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-colors"
                            >
                                <Icon
                                    icon="mdi:open-in-new"
                                    width={18}
                                    height={18}
                                />
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
                    currentModel={ollamaModel}
                    onSelectModel={(modelName) => {
                        void updateChatParams({ ollamaModel: modelName });
                    }}
                    onClose={() => setIsModelsPickOpen(false)}
                />
            </Modal>

            <Modal
                open={isMissingPiperModalOpen}
                onClose={() => setIsMissingPiperModalOpen(false)}
                title="Piper не установлен"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            className="p-2"
                            shape="rounded-lg"
                            onClick={() => setIsMissingPiperModalOpen(false)}
                        >
                            Позже
                        </Button>
                        <Button
                            variant="primary"
                            className="p-2"
                            shape="rounded-lg"
                            onClick={() => {
                                setIsMissingPiperModalOpen(false);
                                navigate("/ext");
                            }}
                        >
                            Открыть расширения
                        </Button>
                    </>
                }
                className="max-w-xl"
            >
                <p className="text-sm text-main-200">
                    Для синтеза речи нужно установить расширение Piper.
                    Перейдите во вкладку «Расширения», установите Piper и
                    перезапустите приложение.
                </p>
            </Modal>
        </div>
    );
};
