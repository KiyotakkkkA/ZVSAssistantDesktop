import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

type PiperServiceOptions = {
    tempDir: string;
    resolvePiperExecutablePath: () => Promise<string | null>;
};

const DEFAULT_PIPER_MODEL_PATH =
    process.env.PIPER_MODEL_PATH?.trim() ||
    process.env.PIPER_MODEL?.trim() ||
    "";

export class PiperService {
    private readonly outputWavPath: string;
    private readonly resolvePiperExecutablePath: () => Promise<string | null>;

    constructor(options: PiperServiceOptions) {
        this.outputWavPath = path.join(
            options.tempDir,
            "zvs-assistant-tts.wav",
        );
        this.resolvePiperExecutablePath = options.resolvePiperExecutablePath;
    }

    async synthesize(text: string): Promise<Uint8Array> {
        const normalizedText = text.trim();

        if (!normalizedText) {
            throw new Error("Пустой текст для синтеза речи");
        }

        const piperExecutablePath = await this.resolvePiperExecutablePath();

        if (!piperExecutablePath) {
            throw new Error(
                "Piper не установлен. Откройте вкладку «Расширения» и установите Piper.",
            );
        }

        const modelPath = await this.resolveModelPath(piperExecutablePath);

        if (!modelPath) {
            throw new Error(
                "Не задан путь к модели Piper. Укажите переменную окружения PIPER_MODEL_PATH.",
            );
        }

        await this.runPiper(normalizedText, piperExecutablePath, modelPath);

        try {
            const wavBuffer = await fs.readFile(this.outputWavPath);
            return new Uint8Array(wavBuffer);
        } finally {
            try {
                await fs.unlink(this.outputWavPath);
            } catch {
                // noop
            }
        }
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

            child.stdin.write(text);
            child.stdin.end();
        });
    }

    private async resolveModelPath(
        piperExecutablePath: string,
    ): Promise<string | null> {
        if (DEFAULT_PIPER_MODEL_PATH) {
            return DEFAULT_PIPER_MODEL_PATH;
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

                if (entry.name.toLowerCase().endsWith(".onnx")) {
                    return entryPath;
                }
            }
        }

        return null;
    }
}
