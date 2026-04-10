import { InputBig, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../../../stores/profileStore";

export const SettingsAssistantPanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;

    if (!currentUser || !generalData) {
        return null;
    }

    return (
        <div className="space-y-5 animate-page-fade-in">
            <PrettyBR icon="mdi:robot" label="Ассистент" size={20} />

            <div className="mt-4 space-y-4 animate-card-rise-in">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-main-200">
                        Имя ассистента
                    </p>
                    <InputSmall
                        value={generalData.assistantName}
                        onChange={(event) =>
                            profileStore.updateGeneralData({
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
                        value={String(generalData.maxToolsUsagePerResponse)}
                        onChange={(event) => {
                            const raw = Number(event.target.value);
                            if (!Number.isFinite(raw)) {
                                profileStore.updateGeneralData({
                                    maxToolsUsagePerResponse: 1,
                                });
                                return;
                            }

                            const nextValue = Math.max(1, Math.floor(raw));
                            profileStore.updateGeneralData({
                                maxToolsUsagePerResponse: nextValue,
                            });
                        }}
                        placeholder="4"
                        type="number"
                        min={1}
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-main-200">
                        Предпочитаемый язык
                    </p>
                    <InputSmall
                        value={generalData.preferredLanguage}
                        onChange={(event) =>
                            profileStore.updateGeneralData({
                                preferredLanguage: event.target.value,
                            })
                        }
                        placeholder="Русский"
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-main-200">
                        Пользовательский промпт
                    </p>
                    <InputBig
                        value={generalData.userPrompt}
                        onChange={(value) =>
                            profileStore.updateGeneralData({
                                userPrompt: value.target.value,
                            })
                        }
                        placeholder="Введите инструкции для модели"
                        className="h-28 rounded-xl border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100 placeholder:text-main-500"
                    />
                </div>
            </div>
        </div>
    );
});
