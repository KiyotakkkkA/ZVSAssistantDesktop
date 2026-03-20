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
        const currentUser = profileStore.user;

        if (!profileApi || !currentUser) {
            return;
        }

        const selectedTheme = await profileApi.getThemeData(themeId);
        applyThemePalette(selectedTheme.palette);
        await profileStore.updateProfile(currentUser.id, {
            generalData: {
                ...currentUser.generalData,
                preferredTheme: themeId,
            },
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
