import { Select } from "@kiyotakkkka/zvs-uikit-lib";
import { useTheme } from "../../../../hooks/useTheme";

export const SettingsInterfacePanel = () => {
    const { themePreference, themeOptions, setTheme } = useTheme();

    return (
        <div className="py-3 flex items-center justify-between border-b border-main-700/80">
            <span className="text-sm font-medium text-main-200">Тема</span>

            <Select
                value={themePreference}
                onChange={(nextValue: string) => {
                    void setTheme(nextValue);
                }}
                options={themeOptions}
                placeholder="Выберите тему"
                className="rounded-xl bg-main-800/70 hover:bg-main-700/70 px-3 py-2 text-main-100"
                wrapperClassName="text-main-200"
            />
        </div>
    );
};
