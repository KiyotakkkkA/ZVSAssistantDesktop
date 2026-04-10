import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib/ui";
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
                    <p className="text-sm font-medium text-main-200">
                        Имя пользователя
                    </p>
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
            </div>
        </div>
    );
});
