import { Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useTheme } from "../../../../hooks/useTheme";
import { SettingsColoredCheckboxRow } from "../../molecules/settings";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../../../stores/profileStore";

export const SettingsInterfacePanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;
    const { themePreference, themeOptions, setTheme } = useTheme();

    return (
        <div className="space-y-4">
            <div className="py-3 flex items-center justify-between border-b border-main-700/80">
                <span className="text-sm font-medium text-main-200">Тема</span>

                <Select
                    value={themePreference}
                    onChange={(nextValue: string) => {
                        void setTheme(nextValue);
                    }}
                    options={themeOptions}
                    placeholder="Выберите тему"
                    className="rounded-xl bg-main-800/70 hover:bg-main-700/70 text-main-100"
                />
            </div>
            <SettingsColoredCheckboxRow
                checked={generalData?.isExtendedInterfaceModeEnabled ?? false}
                icon={"mdi:eye-outline"}
                label={"Отображать весь контент"}
                description={
                    generalData?.isExtendedInterfaceModeEnabled
                        ? "Отображается весь доступный контент приложения"
                        : "Отображаются только необходимые элементы интерфейса"
                }
                onChange={(checked) => {
                    profileStore.updateGeneralData({
                        isExtendedInterfaceModeEnabled: checked,
                    });
                }}
            />
        </div>
    );
});
