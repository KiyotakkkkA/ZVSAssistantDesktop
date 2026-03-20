import fs from "node:fs";
import path from "node:path";
import { staticThemeEntries } from "../static/themes";
import type { ElectronPaths } from "../paths";

export class InitService {
    private readonly resourcesPath: string;
    private readonly themesPath: string;

    constructor(paths: ElectronPaths) {
        this.resourcesPath = paths.resourcesPath;
        this.themesPath = paths.themesPath;
    }

    initialize(): void {
        this.ensureDirectory(this.resourcesPath);
        this.ensureDirectory(this.themesPath);
        this.ensureThemes();
    }

    private ensureDirectory(targetPath: string): void {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    }

    private ensureThemes(): void {
        for (const entry of staticThemeEntries) {
            const themeFilePath = path.join(this.themesPath, entry.fileName);

            if (!fs.existsSync(themeFilePath)) {
                fs.writeFileSync(
                    themeFilePath,
                    JSON.stringify(entry.data, null, 2),
                );
            }
        }
    }
}
