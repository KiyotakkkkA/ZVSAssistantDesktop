import { useMemo } from "react";
import { useThemeContext } from "../providers";

export const useTheme = () => {
    const {
        isReady,
        themePreference,
        themesList,
        preferredThemeData,
        setTheme,
    } = useThemeContext();

    const themeOptions = useMemo(
        () =>
            themesList.map((theme) => ({
                value: theme.id,
                label: theme.name,
            })),
        [themesList],
    );

    return {
        isReady,
        themePreference,
        preferredThemeData,
        themeOptions,
        setTheme,
    };
};
