import { useCallback, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";
import { profileStore } from "../stores/profileStore";

const applyThemePalette = (palette: Record<string, string>) => {
    const root = document.documentElement;

    Object.entries(palette).forEach(([variableName, variableValue]) => {
        root.style.setProperty(variableName, variableValue);
    });
};

type ThemeProviderProps = {
    children: ReactNode;
};

export const ThemeProvider = observer(({ children }: ThemeProviderProps) => {
    const isUserProfileReady = profileStore.isBootstrapped;
    const themePreference = profileStore.user?.generalData.preferredTheme ?? "";
    const themesList = profileStore.themes;

    const setTheme = useCallback(async (themeId: string) => {
        const profileApi = window.profile;
        const nextThemeId = String(themeId ?? "").trim();

        if (!profileApi || !nextThemeId) {
            return;
        }

        const selectedTheme = await profileApi.getThemeData(nextThemeId);
        applyThemePalette(selectedTheme.palette);

        profileStore.updateGeneralData({
            preferredTheme: nextThemeId,
        });
    }, []);

    const contextValue: ThemeContextValue = {
        isReady: isUserProfileReady,
        themePreference,
        themesList,
        preferredThemeData: profileStore.currentTheme?.palette ?? {},
        setTheme,
    };

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
});
