import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
    attemptOr,
    attemptOrNull,
    raiseBusinessError,
} from "../../errors/errorPattern";

type PiperServiceOptions = {
    tempDir: string;
    resolvePiperExecutablePath: () => Promise<string | null>;
    resolveConfiguredModelPath: () => Promise<string>;
};

const DEFAULT_PIPER_MODEL_PATH =
    process.env.PIPER_MODEL_PATH?.trim() ||
    process.env.PIPER_MODEL?.trim() ||
    "";

export class PiperService {
    private readonly outputWavPath: string;
    private readonly resolvePiperExecutablePath: () => Promise<string | null>;
    private readonly resolveConfiguredModelPath: () => Promise<string>;

    constructor(options: PiperServiceOptions) {
        this.outputWavPath = path.join(
            options.tempDir,
            "zvs-assistant-tts.wav",
        );
        this.resolvePiperExecutablePath = options.resolvePiperExecutablePath;
        this.resolveConfiguredModelPath = options.resolveConfiguredModelPath;
    }

    async synthesize(text: string): Promise<Uint8Array> {
        const normalizedText = text.trim();

        if (!normalizedText) {
            raiseBusinessError(
                "PIPER_EMPTY_TEXT",
                "Пустой текст для синтеза речи",
            );
        }

        const piperExecutablePath = await this.resolvePiperExecutablePath();

        if (!piperExecutablePath) {
            raiseBusinessError(
                "PIPER_NOT_INSTALLED",
                "Piper не установлен. Откройте вкладку «Расширения» и установите Piper.",
            );
        }

        const configuredModelPath = await this.resolveConfiguredModelPath();
        const modelPath = await this.resolveModelPath(
            piperExecutablePath as string,
            configuredModelPath,
        );

        if (!modelPath) {
            raiseBusinessError(
                "PIPER_MODEL_NOT_FOUND",
                "Не найдена модель Piper. Укажите директорию модели в настройках или переменную окружения PIPER_MODEL_PATH.",
            );
        }

        await this.runPiper(
            normalizedText,
            piperExecutablePath as string,
            modelPath as string,
        );

        const wavBuffer = await fs.readFile(this.outputWavPath);
        await attemptOr(() => fs.unlink(this.outputWavPath), undefined);
        return new Uint8Array(wavBuffer);
    }

    private async runPiper(
        text: string,
        piperExecutablePath: string,
        modelPath: string,
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(
                piperExecutablePath,
                ["--model", modelPath, "--output_file", this.outputWavPath],
                {
                    windowsHide: true,
                    stdio: ["pipe", "pipe", "pipe"],
                },
            );

            let stderr = "";

            child.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf-8");
            });

            child.on("error", (error) => {
                reject(
                    new Error(
                        `Не удалось запустить Piper (${error.message}). Проверьте установку расширения Piper.`,
                    ),
                );
            });

            child.on("close", (code) => {
                if (code !== 0) {
                    reject(
                        new Error(
                            stderr.trim() ||
                                `Piper завершился с кодом ${String(code)}`,
                        ),
                    );
                    return;
                }

                resolve();
            });

            child.stdin.on("error", (error) => {
                reject(
                    new Error(
                        `Ошибка записи в stdin Piper (${error.message})`,
                    ),
                );
            });

            child.stdin.write(text);
            child.stdin.end();
        });
    }

    private async resolveModelPath(
        piperExecutablePath: string,
        configuredModelPath: string,
    ): Promise<string | null> {
        const normalizedConfiguredModelPath = configuredModelPath.trim();

        if (normalizedConfiguredModelPath) {
            const fromProfile = await this.resolveCandidatePath(
                normalizedConfiguredModelPath,
            );

            if (fromProfile) {
                return fromProfile;
            }
        }

        if (DEFAULT_PIPER_MODEL_PATH) {
            const fromEnv = await this.resolveCandidatePath(
                DEFAULT_PIPER_MODEL_PATH,
            );

            if (fromEnv) {
                return fromEnv;
            }
        }

        const executableDirectory = path.dirname(piperExecutablePath);
        const root = path.dirname(executableDirectory);
        const stack = [root, executableDirectory];
        const seen = new Set<string>();

        while (stack.length > 0) {
            const currentPath = stack.pop();

            if (!currentPath || seen.has(currentPath)) {
                continue;
            }

            seen.add(currentPath);

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

                if (entry.name.toLowerCase().endsWith(".onnx")) {
                    return entryPath;
                }
            }
        }

        return null;
    }

    private async resolveCandidatePath(
        candidatePath: string,
    ): Promise<string | null> {
        const trimmedPath = candidatePath.trim();

        if (!trimmedPath) {
            return null;
        }

        const stat = await attemptOrNull(() => fs.stat(trimmedPath));

        if (!stat) {
            return null;
        }

        if (stat.isFile()) {
            return trimmedPath.toLowerCase().endsWith(".onnx")
                ? trimmedPath
                : null;
        }

        if (!stat.isDirectory()) {
            return null;
        }

        const stack = [trimmedPath];
        const visited = new Set<string>();

        while (stack.length > 0) {
            const currentPath = stack.pop();

            if (!currentPath || visited.has(currentPath)) {
                continue;
            }

            visited.add(currentPath);

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

                if (
                    entry.isFile() &&
                    entry.name.toLowerCase().endsWith(".onnx")
                ) {
                    return entryPath;
                }
            }
        }

        return null;
    }
}
