import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
    attemptSyncOr,
    raiseBusinessError,
    runWithServiceBoundary,
} from "./errors/errorPattern";

export type CommandExecResult = {
    command: string;
    cwd: string;
    isAdmin: false;
    exitCode: number;
    stdout: string;
    stderr: string;
};

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const decodeOutput = (buffer: Buffer): string => {
    const utf8 = buffer.toString("utf8");

    if (process.platform !== "win32") {
        return utf8;
    }

    return attemptSyncOr(() => {
        const cp866 = new TextDecoder("ibm866").decode(buffer);
        const utf8ReplacementCount = (utf8.match(/�/g) || []).length;
        const cp866ReplacementCount = (cp866.match(/�/g) || []).length;

        return cp866ReplacementCount < utf8ReplacementCount ? cp866 : utf8;
    }, utf8);
};

export class CommandExecService {
    async execute(command: string, cwd?: string): Promise<CommandExecResult> {
        return runWithServiceBoundary("command-exec.execute", async () => {
            const trimmedCommand = command.trim();

            if (!trimmedCommand) {
                raiseBusinessError(
                    "COMMAND_EMPTY",
                    "Команда для выполнения не указана",
                );
            }

            const resolvedCwd = cwd?.trim() ? path.resolve(cwd) : process.cwd();

            if (!fs.existsSync(resolvedCwd)) {
                raiseBusinessError(
                    "CWD_NOT_FOUND",
                    `Рабочая директория не существует: ${resolvedCwd}`,
                );
            }

            const executableCommand =
                process.platform === "win32"
                    ? `chcp 65001>nul & ${trimmedCommand}`
                    : trimmedCommand;

            return new Promise<CommandExecResult>((resolve, reject) => {
                const child = spawn(executableCommand, {
                    cwd: resolvedCwd,
                    shell: true,
                    windowsHide: true,
                });

                const stdoutChunks: Buffer[] = [];
                const stderrChunks: Buffer[] = [];
                let stdoutBytes = 0;
                let stderrBytes = 0;
                let stdoutTruncated = false;
                let stderrTruncated = false;

                const appendChunk = (
                    chunks: Buffer[],
                    chunk: Buffer,
                    bytes: number,
                ): {
                    nextBytes: number;
                    truncated: boolean;
                } => {
                    if (bytes >= MAX_OUTPUT_BYTES) {
                        return {
                            nextBytes: bytes,
                            truncated: true,
                        };
                    }

                    const remaining = MAX_OUTPUT_BYTES - bytes;

                    if (chunk.byteLength <= remaining) {
                        chunks.push(chunk);
                        return {
                            nextBytes: bytes + chunk.byteLength,
                            truncated: false,
                        };
                    }

                    chunks.push(chunk.subarray(0, remaining));

                    return {
                        nextBytes: MAX_OUTPUT_BYTES,
                        truncated: true,
                    };
                };

                child.stdout.on("data", (chunk) => {
                    const buffer = Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(String(chunk));
                    const result = appendChunk(
                        stdoutChunks,
                        buffer,
                        stdoutBytes,
                    );
                    stdoutBytes = result.nextBytes;
                    stdoutTruncated = stdoutTruncated || result.truncated;
                });

                child.stderr.on("data", (chunk) => {
                    const buffer = Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(String(chunk));
                    const result = appendChunk(
                        stderrChunks,
                        buffer,
                        stderrBytes,
                    );
                    stderrBytes = result.nextBytes;
                    stderrTruncated = stderrTruncated || result.truncated;
                });

                child.on("error", (error) => {
                    reject(error);
                });

                child.on("close", (code) => {
                    const stdoutBase = decodeOutput(
                        Buffer.concat(stdoutChunks),
                    );
                    const stderrBase = decodeOutput(
                        Buffer.concat(stderrChunks),
                    );
                    const stdout = stdoutTruncated
                        ? `${stdoutBase}\n\n[output truncated to ${MAX_OUTPUT_BYTES} bytes]`
                        : stdoutBase;
                    const stderr = stderrTruncated
                        ? `${stderrBase}\n\n[output truncated to ${MAX_OUTPUT_BYTES} bytes]`
                        : stderrBase;

                    resolve({
                        command: trimmedCommand,
                        cwd: resolvedCwd,
                        isAdmin: false,
                        exitCode: typeof code === "number" ? code : -1,
                        stdout,
                        stderr,
                    });
                });
            });
        });
    }
}
