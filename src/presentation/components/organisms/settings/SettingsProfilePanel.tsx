import { InputBig, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../../../stores/profileStore";

export const SettingsProfilePanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;

    if (!currentUser || !generalData) {
        return null;
    }

    return (
        <div className="rounded-2xl bg-main-900/40 p-4">
            <h4 className="text-sm font-semibold text-main-100">Профиль</h4>

            <div className="mt-4 space-y-4">
                <div className="space-y-2">
                    <p className="text-sm font-medium text-main-200">Имя</p>
                    <InputSmall
                        value={generalData.name}
                        onChange={(event) =>
                            profileStore.updateGeneralData({
                                name: event.target.value,
                            })
                        }
                        placeholder="Пользователь"
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
