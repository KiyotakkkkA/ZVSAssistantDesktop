import fs from "node:fs";
import path from "node:path";
import { staticThemeEntries } from "../static/themes";
import type { ElectronPaths } from "../paths";

export class InitService {
    private readonly resourcesPath: string;
    private readonly extensionsPath: string;
    private readonly themesPath: string;
    private readonly filesPath: string;
    private readonly vectorIndexPath: string;
    private readonly metaPath: string;
    private readonly databasePath: string;

    constructor(paths: ElectronPaths) {
        this.resourcesPath = paths.resourcesPath;
        this.extensionsPath = paths.extensionsPath;
        this.themesPath = paths.themesPath;
        this.filesPath = paths.filesPath;
        this.vectorIndexPath = paths.vectorIndexPath;
        this.metaPath = paths.metaPath;
        this.databasePath = paths.databasePath;
    }

    initialize(): void {
        this.ensureDirectory(this.resourcesPath);
        this.ensureDirectory(this.extensionsPath);
        this.ensureDirectory(this.themesPath);
        this.ensureDirectory(this.filesPath);
        this.ensureDirectory(this.vectorIndexPath);
        this.ensureDatabase(this.databasePath);
        this.ensureMeta();
        this.ensureThemes();
    }

    private ensureDirectory(targetPath: string): void {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
    }

    private ensureDatabase(databasePath: string): void {
        if (!fs.existsSync(databasePath)) {
            fs.writeFileSync(databasePath, "");
        }
    }

    private ensureMeta(): void {
        if (!fs.existsSync(this.metaPath)) {
            fs.writeFileSync(
                this.metaPath,
                JSON.stringify({ currentUserId: "" }, null, 2),
            );
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
