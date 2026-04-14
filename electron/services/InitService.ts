import fs from "node:fs";
import path from "node:path";
import { staticThemeEntries } from "../static/themes";
import type { ElectronPaths } from "../paths";

export class InitService {
    private readonly resourcesPath: string;
    private readonly themesPath: string;
    private readonly databasePath: string;
    private readonly storagePath: string;

    constructor(paths: ElectronPaths) {
        this.resourcesPath = paths.resourcesPath;
        this.themesPath = paths.themesPath;
        this.databasePath = paths.databasePath;
        this.storagePath = paths.storagePath;
    }

    initialize(): void {
        this.ensureDirectory(this.resourcesPath);
        this.ensureDirectory(this.themesPath);
        this.ensureDirectory(this.storagePath);
        this.ensureDatabase(this.databasePath);
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

    private ensureDatabase(databasePath: string): void {
        if (!fs.existsSync(databasePath)) {
            fs.writeFileSync(databasePath, "");
        }
    }
}
