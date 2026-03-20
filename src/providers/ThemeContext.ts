import { createContext } from "react";
import { ThemeData } from "../../electron/static/themes/types";

export type ThemeContextValue = {
    isReady: boolean;
    themePreference: string;
    themesList: Omit<ThemeData, "palette">[];
    preferredThemeData: Record<string, string>;
    setTheme: (themeId: string) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);
