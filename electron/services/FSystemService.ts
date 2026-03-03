import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

export type ListedEntry = {
    name: string;
    type: "directory" | "file";
    size: number;
    modifiedAt: string;
};

export class FSystemService {
    async listDirectory(cwd: string): Promise<{
        path: string;
        entries: ListedEntry[];
    }> {
        const entries = await fsPromises.readdir(cwd, { withFileTypes: true });
        const result = await Promise.all(
            entries.map(async (entry) => {
                const entryPath = path.join(cwd, entry.name);
                const stat = await fsPromises.stat(entryPath);

                return {
                    name: entry.name,
                    type: entry.isDirectory() ? "directory" : "file",
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                } satisfies ListedEntry;
            }),
        );

        return {
            path: cwd,
            entries: result,
        };
    }

    async createFile(
        cwd: string,
        filename: string,
        content = "",
    ): Promise<{ success: true; path: string }> {
        const filePath = path.join(cwd, filename);

        await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
        await fsPromises.writeFile(filePath, content, "utf-8");

        return { success: true, path: filePath };
    }

    async createDir(
        cwd: string,
        dirname: string,
    ): Promise<{ success: true; path: string }> {
        const dirPath = path.join(cwd, dirname);

        await fsPromises.mkdir(dirPath, { recursive: true });

        return { success: true, path: dirPath };
    }

    async readTextFileRange(
        filePath: string,
        readAll: boolean,
        fromLine?: number,
        toLine?: number,
    ): Promise<{
        path: string;
        content: string;
        totalLines: number;
        fromLine: number;
        toLine: number;
    }> {
        const raw = await fsPromises.readFile(filePath, "utf-8");
        const lines = raw.split("\n");
        const totalLines = lines.length;

        if (readAll) {
            return {
                path: filePath,
                content: raw,
                totalLines,
                fromLine: 1,
                toLine: totalLines,
            };
        }

        const from = Math.max(1, fromLine ?? 1);
        const to = Math.min(totalLines, toLine ?? totalLines);
        const content = lines.slice(from - 1, to).join("\n");

        return {
            path: filePath,
            content,
            totalLines,
            fromLine: from,
            toLine: to,
        };
    }

    async readFileBuffer(filePath: string): Promise<Buffer> {
        return fsPromises.readFile(filePath);
    }

    async writeFileBuffer(filePath: string, data: Buffer): Promise<void> {
        await fsPromises.writeFile(filePath, data);
    }

    writeFileBufferSync(filePath: string, data: Buffer): void {
        fs.writeFileSync(filePath, data);
    }

    existsSync(targetPath: string): boolean {
        return fs.existsSync(targetPath);
    }

    deleteFileIfExistsSync(filePath: string): void {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
