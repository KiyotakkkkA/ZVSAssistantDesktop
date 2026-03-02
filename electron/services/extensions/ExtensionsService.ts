import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import AdmZip from "adm-zip";
import type { AppExtensionInfo } from "../../../src/types/App";
import {
    attemptOr,
    attemptOrNull,
    raiseBusinessError,
} from "../../errors/errorPattern";

type ExtensionManifest = {
    id: string;
    title: string;
    description: string;
    repositoryUrl: string;
    releaseZipUrl: string;
    executableBasenames: string[];
};

const EXTENSIONS_MANIFEST: ExtensionManifest[] = [
    {
        id: "piper",
        title: "Piper TTS",
        description:
            "Локальный синтез речи Piper для озвучивания ответов ассистента.",
        repositoryUrl: "https://github.com/rhasspy/piper",
        releaseZipUrl:
            "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip",
        executableBasenames:
            process.platform === "win32" ? ["piper.exe"] : ["piper"],
    },
];

type InstallExtensionInput = {
    extensionId: string;
    releaseZipUrl: string;
    signal: AbortSignal;
    onStage?: (
        message: string,
        tag?: "info" | "success" | "warning" | "error",
    ) => void;
};

const entryBasenameSet = (entry: ExtensionManifest): Set<string> =>
    new Set(entry.executableBasenames.map((name) => name.toLowerCase()));

const normalizePath = (targetPath: string): string =>
    path.normalize(targetPath).replace(/[\\/]+$/, "");

export class ExtensionsService {
    constructor(private readonly extensionsBasePath: string) {}

    async getExtensionsState(): Promise<AppExtensionInfo[]> {
        return Promise.all(
            EXTENSIONS_MANIFEST.map(async (entry) => {
                const installPath = path.join(
                    this.extensionsBasePath,
                    entry.id,
                );
                const detectedExecutable = await this.findExecutable(
                    installPath,
                    entryBasenameSet(entry),
                );

                return {
                    id: entry.id,
                    title: entry.title,
                    description: entry.description,
                    repositoryUrl: entry.repositoryUrl,
                    releaseZipUrl: entry.releaseZipUrl,
                    installPath,
                    entryFilePath: detectedExecutable ?? "",
                    isInstalled: Boolean(detectedExecutable),
                };
            }),
        );
    }

    async getExtensionStateById(
        extensionId: string,
    ): Promise<AppExtensionInfo | null> {
        const all = await this.getExtensionsState();
        return all.find((entry) => entry.id === extensionId) ?? null;
    }

    async resolvePiperExecutablePath(): Promise<string | null> {
        const piperState = await this.getExtensionStateById("piper");

        if (!piperState?.isInstalled || !piperState.entryFilePath) {
            return null;
        }

        return piperState.entryFilePath;
    }

    async installFromGithubRelease({
        extensionId,
        releaseZipUrl,
        signal,
        onStage,
    }: InstallExtensionInput): Promise<AppExtensionInfo> {
        const manifestEntry = EXTENSIONS_MANIFEST.find(
            (entry) => entry.id === extensionId,
        );

        if (!manifestEntry) {
            raiseBusinessError(
                "EXTENSION_NOT_SUPPORTED",
                `Расширение '${extensionId}' не поддерживается`,
            );
        }

        const selectedManifest = manifestEntry as ExtensionManifest;

        const normalizedUrl =
            releaseZipUrl.trim() || selectedManifest.releaseZipUrl;

        if (!normalizedUrl) {
            raiseBusinessError(
                "EXTENSION_URL_EMPTY",
                "Не указан URL архива расширения",
            );
        }

        const installPath = path.join(this.extensionsBasePath, extensionId);
        await fs.mkdir(this.extensionsBasePath, { recursive: true });

        const tempZipPath = path.join(
            this.extensionsBasePath,
            `${extensionId}-${Date.now()}-${randomUUID()}.zip`,
        );

        onStage?.("Скачивание архива расширения", "info");
        await this.downloadArchive(normalizedUrl, tempZipPath, signal);

        onStage?.("Подготовка директории расширения", "info");
        await fs.rm(installPath, { recursive: true, force: true });
        await fs.mkdir(installPath, { recursive: true });

        onStage?.("Распаковка архива расширения", "info");
        await this.extractArchive(tempZipPath, installPath, signal);
        await attemptOr(() => fs.rm(tempZipPath, { force: true }), undefined);

        const installedState = await this.getExtensionStateById(extensionId);

        if (!installedState?.isInstalled) {
            raiseBusinessError(
                "EXTENSION_ENTRY_NOT_FOUND",
                "Расширение установлено, но исполняемый файл не найден после распаковки",
            );
        }

        const ensuredInstalledState = installedState as AppExtensionInfo;

        onStage?.("Расширение установлено", "success");
        return ensuredInstalledState;
    }

    private async downloadArchive(
        url: string,
        targetPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        if (signal.aborted) {
            raiseBusinessError(
                "EXTENSION_INSTALL_ABORTED",
                "Установка расширения была прервана",
            );
        }

        const response = await fetch(url, { signal });

        if (!response.ok) {
            raiseBusinessError(
                "EXTENSION_DOWNLOAD_FAILED",
                `Не удалось скачать архив (${response.status})`,
            );
        }

        const rawBytes = await response.arrayBuffer();

        if (signal.aborted) {
            raiseBusinessError(
                "EXTENSION_INSTALL_ABORTED",
                "Установка расширения была прервана",
            );
        }

        await fs.writeFile(targetPath, Buffer.from(rawBytes));
    }

    private async extractArchive(
        zipPath: string,
        outputPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        if (signal.aborted) {
            raiseBusinessError(
                "EXTENSION_INSTALL_ABORTED",
                "Установка расширения была прервана",
            );
        }

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(outputPath, true);

        if (signal.aborted) {
            raiseBusinessError(
                "EXTENSION_INSTALL_ABORTED",
                "Установка расширения была прервана",
            );
        }

        if (process.platform !== "win32") {
            const allState = await this.getExtensionsState();
            const installed = allState.find(
                (entry) =>
                    normalizePath(entry.installPath) ===
                    normalizePath(outputPath),
            );

            if (installed?.entryFilePath) {
                await attemptOr(
                    () => fs.chmod(installed.entryFilePath, 0o755),
                    undefined,
                );
            }
        }
    }

    private async findExecutable(
        rootPath: string,
        executableBasenames: Set<string>,
    ): Promise<string | null> {
        const stat = await attemptOrNull(() => fs.stat(rootPath));

        if (!stat || !stat.isDirectory()) {
            return null;
        }

        const stack: string[] = [rootPath];

        while (stack.length > 0) {
            const currentPath = stack.pop();

            if (!currentPath) {
                continue;
            }

            const entries = await attemptOrNull(() =>
                fs.readdir(currentPath, {
                    withFileTypes: true,
                    encoding: "utf8",
                }),
            );

            if (!entries) {
                continue;
            }

            for (const entry of entries) {
                const entryPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    stack.push(entryPath);
                    continue;
                }

                if (!entry.isFile()) {
                    continue;
                }

                const lowerName = entry.name.toLowerCase();
                if (executableBasenames.has(lowerName)) {
                    return entryPath;
                }
            }
        }

        return null;
    }
}
