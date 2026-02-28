import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import AdmZip from "adm-zip";
import type { AppExtensionInfo } from "../../../src/types/App";

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

const DOWNLOAD_RETRY_DELAYS_MS = [600, 1_200, 2_400] as const;

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
            throw new Error(`Расширение '${extensionId}' не поддерживается`);
        }

        const normalizedUrl =
            releaseZipUrl.trim() || manifestEntry.releaseZipUrl;

        if (!normalizedUrl) {
            throw new Error("Не указан URL архива расширения");
        }

        const installPath = path.join(this.extensionsBasePath, extensionId);
        await fs.mkdir(this.extensionsBasePath, { recursive: true });

        const tempZipPath = path.join(
            this.extensionsBasePath,
            `${extensionId}-${Date.now()}-${randomUUID()}.zip`,
        );

        onStage?.("Скачивание архива расширения", "info");
        try {
            await this.downloadArchive(normalizedUrl, tempZipPath, signal);

            onStage?.("Подготовка директории расширения", "info");
            await fs.rm(installPath, { recursive: true, force: true });
            await fs.mkdir(installPath, { recursive: true });

            onStage?.("Распаковка архива расширения", "info");
            await this.extractArchive(tempZipPath, installPath, signal);
        } finally {
            await fs.rm(tempZipPath, { force: true }).catch(() => {
                // noop
            });
        }

        const installedState = await this.getExtensionStateById(extensionId);

        if (!installedState?.isInstalled) {
            throw new Error(
                "Расширение установлено, но исполняемый файл не найден после распаковки",
            );
        }

        onStage?.("Расширение установлено", "success");
        return installedState;
    }

    private async downloadArchive(
        url: string,
        targetPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        let lastError: Error | null = null;

        for (let attemptIndex = 0; attemptIndex < DOWNLOAD_RETRY_DELAYS_MS.length; attemptIndex += 1) {
            if (signal.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            try {
                await this.downloadArchiveViaFetch(url, targetPath, signal);
                return;
            } catch (error) {
                const normalizedError =
                    error instanceof Error
                        ? error
                        : new Error("Ошибка скачивания архива");
                lastError = normalizedError;

                if (signal.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }

                await this.delay(DOWNLOAD_RETRY_DELAYS_MS[attemptIndex], signal);
            }
        }

        if (process.platform === "win32") {
            try {
                await this.downloadArchiveViaPowerShell(url, targetPath, signal);
                return;
            } catch (error) {
                const normalizedError =
                    error instanceof Error
                        ? error
                        : new Error("PowerShell download failed");
                lastError = normalizedError;
            }
        }

        throw new Error(
            `Не удалось скачать архив расширения: ${lastError?.message || "неизвестная ошибка"}`,
        );
    }

    private async downloadArchiveViaFetch(
        url: string,
        targetPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        const response = await fetch(url, {
            signal,
            redirect: "follow",
            headers: {
                "User-Agent": "zvs-assistant-installer/1.0",
                Accept: "application/octet-stream,application/zip,*/*",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rawBytes = await response.arrayBuffer();

        if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        await fs.writeFile(targetPath, Buffer.from(rawBytes));
    }

    private async downloadArchiveViaPowerShell(
        url: string,
        targetPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        const escapedUrl = url.replace(/'/g, "''");
        const escapedTargetPath = targetPath.replace(/'/g, "''");
        const command = [
            "$ProgressPreference='SilentlyContinue'",
            `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`,
            `Invoke-WebRequest -UseBasicParsing -Uri '${escapedUrl}' -OutFile '${escapedTargetPath}'`,
        ].join("; ");

        await new Promise<void>((resolve, reject) => {
            const child = spawn(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    command,
                ],
                {
                    windowsHide: true,
                    stdio: ["ignore", "pipe", "pipe"],
                },
            );

            let stderr = "";
            child.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf-8");
            });

            const onAbort = () => {
                child.kill();
                reject(new DOMException("Aborted", "AbortError"));
            };

            signal.addEventListener("abort", onAbort, { once: true });

            child.on("error", (error) => {
                signal.removeEventListener("abort", onAbort);
                reject(error);
            });

            child.on("close", (code) => {
                signal.removeEventListener("abort", onAbort);

                if (code !== 0) {
                    reject(
                        new Error(
                            stderr.trim() ||
                                `PowerShell завершился с кодом ${String(code)}`,
                        ),
                    );
                    return;
                }

                resolve();
            });
        });
    }

    private async delay(ms: number, signal: AbortSignal): Promise<void> {
        if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                signal.removeEventListener("abort", onAbort);
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeoutId);
                signal.removeEventListener("abort", onAbort);
                reject(new DOMException("Aborted", "AbortError"));
            };

            signal.addEventListener("abort", onAbort, { once: true });
        });
    }

    private async extractArchive(
        zipPath: string,
        outputPath: string,
        signal: AbortSignal,
    ): Promise<void> {
        if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(outputPath, true);

        if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        if (process.platform !== "win32") {
            const allState = await this.getExtensionsState();
            const installed = allState.find(
                (entry) =>
                    normalizePath(entry.installPath) ===
                    normalizePath(outputPath),
            );

            if (installed?.entryFilePath) {
                await fs.chmod(installed.entryFilePath, 0o755).catch(() => {
                    // noop
                });
            }
        }
    }

    private async findExecutable(
        rootPath: string,
        executableBasenames: Set<string>,
    ): Promise<string | null> {
        try {
            const stat = await fs.stat(rootPath);
            if (!stat.isDirectory()) {
                return null;
            }
        } catch {
            return null;
        }

        const stack: string[] = [rootPath];

        while (stack.length > 0) {
            const currentPath = stack.pop();

            if (!currentPath) {
                continue;
            }

            let entries: Dirent<string>[];
            try {
                entries = await fs.readdir(currentPath, {
                    withFileTypes: true,
                    encoding: "utf8",
                });
            } catch {
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
