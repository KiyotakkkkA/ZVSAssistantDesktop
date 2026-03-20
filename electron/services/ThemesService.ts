import fs from "node:fs";
import path from "node:path";
import { defaultUser } from "../static/data/baseProfile";
import { staticThemesMap, staticThemesList } from "../static/themes";
import type { ThemeData } from "../static/themes/types";

export class ThemesService {
    constructor(private readonly themesPath: string) {}

    private createThemeMap(themes: ThemeData[]): Map<string, ThemeData> {
        return new Map(themes.map((theme) => [theme.id, theme]));
    }

    getThemesList(): Omit<ThemeData, "palette">[] {
        const themes = this.readThemes();

        if (themes.length === 0) {
            return staticThemesList;
        }

        return themes.map((theme) => ({
            id: theme.id,
            name: theme.name,
        }));
    }

    getThemeData(themeId: string): ThemeData {
        const themes = this.readThemes();
        const themeMap = this.createThemeMap(themes);
        const preferredTheme = themeMap.get(themeId);

        if (preferredTheme) {
            return preferredTheme;
        }

        const fallbackTheme = staticThemesMap[themeId];
        if (fallbackTheme) {
            return fallbackTheme;
        }

        return staticThemesMap[defaultUser.generalData.preferredTheme];
    }

    resolveThemePalette(themeId: string): Record<string, string> {
        const themes = this.readThemes();
        const themeMap = this.createThemeMap(themes);
        const preferredTheme = themeMap.get(themeId);

        if (preferredTheme) {
            return preferredTheme.palette;
        }

        return staticThemesMap[defaultUser.generalData.preferredTheme].palette;
    }

    private readThemes(): ThemeData[] {
        const files = fs
            .readdirSync(this.themesPath)
            .filter((fileName) => fileName.endsWith(".json"));

        const result: ThemeData[] = [];

        for (const fileName of files) {
            const filePath = path.join(this.themesPath, fileName);

            const parsed = () => {
                const rawTheme = fs.readFileSync(filePath, "utf-8");
                return JSON.parse(rawTheme) as ThemeData;
            };

            result.push(parsed());
        }

        return result;
    }
}
