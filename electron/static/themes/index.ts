import type { ThemeData } from "./types";
import { baseDarkArcDark } from "./baseDarkArcDark";
import { baseDarkAyuDark } from "./baseDarkAyuDark";
import { baseDarkCatppuccinMocha } from "./baseDarkCatppuccinMocha";
import { baseDarkDracula } from "./baseDarkDracula";
import { baseDarkEverforestDark } from "./baseDarkEverforestDark";
import { baseDarkGithub } from "./baseDarkGithub";
import { baseDarkGruvbox } from "./baseDarkGruvbox";
import { baseDarkGruvboxDark } from "./baseDarkGruvboxDark";
import { baseDarkHighContrast } from "./baseDarkHighContrast";
import { baseDarkKanagawa } from "./baseDarkKanagawa";
import { baseDarkMain } from "./baseDarkMain";
import { baseDarkMaterialOcean } from "./baseDarkMaterialOcean";
import { baseDarkMonokaiPro } from "./baseDarkMonokaiPro";
import { baseDarkNightOwl } from "./baseDarkNightOwl";
import { baseDarkNord } from "./baseDarkNord";
import { baseDarkOneDarkPro } from "./baseDarkOneDarkPro";
import { baseDarkOneDark } from "./baseDarkOneDark";
import { baseDarkPalenight } from "./baseDarkPalenight";
import { baseDarkRosePine } from "./baseDarkRosePine";
import { baseDarkSolarizedDark } from "./baseDarkSolarizedDark";
import { baseDarkSynthwave84 } from "./baseDarkSynthwave84";
import { baseDarkTokyoNight } from "./baseDarkTokyoNight";

export type StaticThemeEntry = {
    fileName: string;
    data: ThemeData;
};

export const staticThemeEntries: StaticThemeEntry[] = [
    { fileName: "baseDarkMain.json", data: baseDarkMain },
    { fileName: "baseDarkDracula.json", data: baseDarkDracula },
    { fileName: "baseDarkNord.json", data: baseDarkNord },
    { fileName: "baseDarkTokyoNight.json", data: baseDarkTokyoNight },
    { fileName: "baseDarkCatppuccinMocha.json", data: baseDarkCatppuccinMocha },
    { fileName: "baseDarkOneDark.json", data: baseDarkOneDark },
    { fileName: "baseDarkOneDarkPro.json", data: baseDarkOneDarkPro },
    { fileName: "baseDarkGruvbox.json", data: baseDarkGruvbox },
    { fileName: "baseDarkGruvboxDark.json", data: baseDarkGruvboxDark },
    { fileName: "baseDarkSolarizedDark.json", data: baseDarkSolarizedDark },
    { fileName: "baseDarkMonokaiPro.json", data: baseDarkMonokaiPro },
    { fileName: "baseDarkMaterialOcean.json", data: baseDarkMaterialOcean },
    { fileName: "baseDarkGithub.json", data: baseDarkGithub },
    { fileName: "baseDarkAyuDark.json", data: baseDarkAyuDark },
    { fileName: "baseDarkPalenight.json", data: baseDarkPalenight },
    { fileName: "baseDarkNightOwl.json", data: baseDarkNightOwl },
    { fileName: "baseDarkRosePine.json", data: baseDarkRosePine },
    { fileName: "baseDarkKanagawa.json", data: baseDarkKanagawa },
    { fileName: "baseDarkEverforestDark.json", data: baseDarkEverforestDark },
    { fileName: "baseDarkSynthwave84.json", data: baseDarkSynthwave84 },
    { fileName: "baseDarkArcDark.json", data: baseDarkArcDark },
    { fileName: "baseDarkHighContrast.json", data: baseDarkHighContrast },
];

export const staticThemes: ThemeData[] = staticThemeEntries.map(
    (entry) => entry.data,
);

export const staticThemesMap: Record<string, ThemeData> = Object.fromEntries(
    staticThemes.map((theme) => [theme.id, theme]),
);

export const staticThemesList: Omit<ThemeData, "palette">[] = staticThemes.map(
    (theme) => ({
        id: theme.id,
        name: theme.name,
    }),
);
