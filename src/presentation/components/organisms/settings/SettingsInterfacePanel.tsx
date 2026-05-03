import { Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useStyle } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { SettingsColoredCheckboxRow } from "../../molecules/settings";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../../../stores/profileStore";

export const SettingsInterfacePanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;
    const { changeTheme } = useStyle();

    return (
        <div className="space-y-4">
            <div className="py-3 flex items-center justify-between border-b border-main-700/80">
                <span className="text-sm font-medium text-main-200">
                    Тема приложения
                </span>

                <Select
                    searchable
                    value={generalData?.preferredTheme || "dark-main"}
                    onChange={async (nextValue: string) => {
                        const selectedTheme =
                            await window.profile.getThemeData(nextValue);

                        changeTheme({
                            50: selectedTheme.palette["--color-main-50"],
                            100: selectedTheme.palette["--color-main-100"],
                            200: selectedTheme.palette["--color-main-200"],
                            300: selectedTheme.palette["--color-main-300"],
                            400: selectedTheme.palette["--color-main-400"],
                            500: selectedTheme.palette["--color-main-500"],
                            600: selectedTheme.palette["--color-main-600"],
                            700: selectedTheme.palette["--color-main-700"],
                            800: selectedTheme.palette["--color-main-800"],
                            900: selectedTheme.palette["--color-main-900"],
                        });

                        profileStore.updateGeneralData({
                            preferredTheme: nextValue,
                        });
                    }}
                    options={profileStore.themes.map((theme) => ({
                        value: theme.id,
                        label: theme.name,
                    }))}
                    placeholder="Выберите тему"
                    classNames={{
                        menu: "border border-main-700/70 shadow-lg bg-main-900/92 backdrop-blur-md",
                        trigger: "bg-main-700/45",
                    }}
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
