import type { ThemeData, ThemeListItem } from "../../../src/types/App";
import { baseDarkDracula } from "./baseDarkDracula";
import { baseDarkGithub } from "./baseDarkGithub";
import { baseDarkGruvbox } from "./baseDarkGruvbox";
import { baseDarkMain } from "./baseDarkMain";
import { baseDarkNord } from "./baseDarkNord";
import { baseDarkOneDark } from "./baseDarkOneDark";

export type StaticThemeEntry = {
    fileName: string;
    data: ThemeData;
};

export const staticThemeEntries: StaticThemeEntry[] = [
    { fileName: "baseDarkMain.json", data: baseDarkMain },
    { fileName: "baseDarkDracula.json", data: baseDarkDracula },
    { fileName: "baseDarkNord.json", data: baseDarkNord },
    { fileName: "baseDarkOneDark.json", data: baseDarkOneDark },
    { fileName: "baseDarkGruvbox.json", data: baseDarkGruvbox },
    { fileName: "baseDarkGithub.json", data: baseDarkGithub },
];

export const staticThemes: ThemeData[] = staticThemeEntries.map(
    (entry) => entry.data,
);

export const staticThemesMap: Record<string, ThemeData> = Object.fromEntries(
    staticThemes.map((theme) => [theme.id, theme]),
);

export const staticThemesList: ThemeListItem[] = staticThemes.map((theme) => ({
    id: theme.id,
    name: theme.name,
}));
