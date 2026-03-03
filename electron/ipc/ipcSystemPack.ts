import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, shell } from "electron";
import type { CommandExecService } from "../services/CommandExecService";
import type { BrowserService } from "../services/BrowserService";
import type { FileStorageService } from "../services/storage/FileStorageService";
import type { FSystemService } from "../services/FSystemService";
import type {
    SaveImageFromSourcePayload,
    UploadedFileData,
} from "../../src/types/ElectronApi";
import { handleIpc, handleIpcWithEvent, handleManyIpc } from "./ipcUtils";

const mimeByExtension: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

const imageExtensions = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
];

const extensionByMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
};

const getMimeTypeByExtension = (filePath: string): string => {
    const extension = path.extname(filePath).toLowerCase();

    return mimeByExtension[extension] || "application/octet-stream";
};

const isRemoteUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataUrl = (value: string) => /^data:/i.test(value);
const isFileUrl = (value: string) => /^file:\/\//i.test(value);

const ensureImageExt = (fileName: string, mimeType: string) => {
    const ext = path.extname(fileName).toLowerCase();

    if (ext) {
        return fileName;
    }

    return `${fileName}${extensionByMime[mimeType] || ".png"}`;
};

const parseDataUrl = (src: string) => {
    const marker = ";base64,";
    const markerIndex = src.indexOf(marker);

    if (markerIndex === -1) {
        throw new Error("Invalid data URL");
    }

    const header = src.slice(0, markerIndex);
    const mimeType = header.slice(5) || "application/octet-stream";
    const base64 = src.slice(markerIndex + marker.length);

    return {
        mimeType,
        buffer: Buffer.from(base64, "base64"),
    };
};

export type IpcSystemPackDeps = {
    commandExecService: CommandExecService;
    browserService: BrowserService;
    fileStorageService: FileStorageService;
    fSystemService: FSystemService;
};

export const registerIpcSystemPack = ({
    commandExecService,
    browserService,
    fileStorageService,
    fSystemService,
}: IpcSystemPackDeps) => {
    handleManyIpc([
        [
            "app:exec-shell-command",
            (command: string, cwd?: string) =>
                commandExecService.execute(command, cwd),
        ],
        [
            "app:browser-open-url",
            (url: string, timeoutMs?: number) =>
                browserService.openUrl(url, timeoutMs),
        ],
        [
            "app:browser-get-page-snapshot",
            (maxElements?: number) =>
                browserService.getPageSnapshot(maxElements),
        ],
        [
            "app:browser-interact-with",
            (params: {
                action: "click" | "type";
                selector: string;
                text?: string;
                submit?: boolean;
                waitForNavigationMs?: number;
            }) => browserService.interactWith(params),
        ],
        ["app:browser-close-session", () => browserService.closeSession()],
    ]);

    handleIpc("app:open-saved-file", async (fileId: string) => {
        const file = fileStorageService.getFileById(fileId);

        if (!file) {
            return false;
        }

        const openResult = await shell.openPath(file.path);
        return openResult === "";
    });

    handleIpc("app:open-path", async (targetPath: string) => {
        if (!targetPath || typeof targetPath !== "string") {
            return false;
        }

        const openResult = await shell.openPath(targetPath);
        return openResult === "";
    });

    handleIpc("app:open-external-url", async (url: string) => {
        if (!url || typeof url !== "string") {
            return false;
        }

        try {
            await shell.openExternal(url);
            return true;
        } catch {
            return false;
        }
    });

    handleIpcWithEvent(
        "app:save-image-from-source",
        async (event, payload: SaveImageFromSourcePayload) => {
            const source =
                typeof payload?.src === "string" ? payload.src.trim() : "";

            if (!source) {
                return null;
            }

            const preferredFileName =
                typeof payload.preferredFileName === "string"
                    ? payload.preferredFileName.trim()
                    : "";

            let sourceKind: "remote" | "local" | "data-url" = "local";
            let buffer: Buffer;
            let mimeType = "application/octet-stream";
            let fileName = preferredFileName || "image";

            if (isDataUrl(source)) {
                sourceKind = "data-url";
                const parsed = parseDataUrl(source);
                buffer = parsed.buffer;
                mimeType = parsed.mimeType;
                fileName = ensureImageExt(fileName, mimeType);
            } else if (isRemoteUrl(source)) {
                sourceKind = "remote";
                const response = await fetch(source);

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch image (${response.status})`,
                    );
                }

                const arrayBuffer = await response.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
                mimeType = response.headers.get("content-type") || mimeType;

                const remoteName = path.basename(
                    new URL(source).pathname || "image",
                );
                fileName = preferredFileName || remoteName || "image";
                fileName = ensureImageExt(fileName, mimeType);
            } else {
                sourceKind = "local";
                const localPath = isFileUrl(source)
                    ? fileURLToPath(source)
                    : source;

                buffer = await fSystemService.readFileBuffer(localPath);
                mimeType = getMimeTypeByExtension(localPath);
                fileName = preferredFileName || path.basename(localPath);
                fileName = ensureImageExt(fileName, mimeType);
            }

            const currentWindow = BrowserWindow.fromWebContents(event.sender);
            const defaultPath = app.getPath("downloads");
            const targetPathByDialog = currentWindow
                ? await dialog.showSaveDialog(currentWindow, {
                      title: "Сохранить изображение",
                      defaultPath: path.join(defaultPath, fileName),
                      filters: [
                          { name: "Images", extensions: imageExtensions },
                      ],
                  })
                : await dialog.showSaveDialog({
                      title: "Сохранить изображение",
                      defaultPath: path.join(defaultPath, fileName),
                      filters: [
                          { name: "Images", extensions: imageExtensions },
                      ],
                  });

            if (targetPathByDialog.canceled || !targetPathByDialog.filePath) {
                return null;
            }

            await fSystemService.writeFileBuffer(
                targetPathByDialog.filePath,
                buffer,
            );

            return {
                savedPath: targetPathByDialog.filePath,
                fileName: path.basename(targetPathByDialog.filePath),
                mimeType,
                size: buffer.byteLength,
                sourceKind,
            };
        },
    );

    handleIpcWithEvent(
        "app:pick-files",
        async (event, options?: { accept?: string[]; multiple?: boolean }) => {
            const currentWindow = BrowserWindow.fromWebContents(event.sender);

            const accept = options?.accept ?? [];
            const filters =
                accept.length > 0
                    ? [
                          {
                              name: "Allowed files",
                              extensions: accept
                                  .flatMap((item) =>
                                      item
                                          .split(",")
                                          .map((part) =>
                                              part.trim().toLowerCase(),
                                          ),
                                  )
                                  .flatMap((item) =>
                                      item === "image/*"
                                          ? imageExtensions
                                          : [item],
                                  )
                                  .map((item) =>
                                      item.startsWith(".")
                                          ? item.slice(1)
                                          : item
                                                .replace(/^[*]/, "")
                                                .replace(/^[.]/, ""),
                                  )
                                  .filter((item) => item && item !== "*"),
                          },
                      ]
                    : [];

            const dialogProperties: Array<"openFile" | "multiSelections"> = [
                "openFile",
            ];

            if (options?.multiple) {
                dialogProperties.push("multiSelections");
            }

            const openDialogOptions = {
                properties: dialogProperties,
                filters,
            };

            const selection = currentWindow
                ? await dialog.showOpenDialog(currentWindow, openDialogOptions)
                : await dialog.showOpenDialog(openDialogOptions);

            if (selection.canceled || selection.filePaths.length === 0) {
                return [] satisfies UploadedFileData[];
            }

            const files = await Promise.all(
                selection.filePaths.map(
                    async (filePath): Promise<UploadedFileData> => {
                        const buffer =
                            await fSystemService.readFileBuffer(filePath);
                        const mimeType = getMimeTypeByExtension(filePath);

                        return {
                            name: path.basename(filePath),
                            mimeType,
                            size: buffer.byteLength,
                            dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
                        };
                    },
                ),
            );

            return files;
        },
    );

    handleIpcWithEvent(
        "app:pick-path",
        async (event, options?: { forFolders?: boolean }) => {
            const currentWindow = BrowserWindow.fromWebContents(event.sender);
            const dialogProperties: Array<"openFile" | "openDirectory"> = [
                options?.forFolders ? "openDirectory" : "openFile",
            ];

            const openDialogOptions = {
                properties: dialogProperties,
            };

            const selection = currentWindow
                ? await dialog.showOpenDialog(currentWindow, openDialogOptions)
                : await dialog.showOpenDialog(openDialogOptions);

            if (selection.canceled || selection.filePaths.length === 0) {
                return null;
            }

            return selection.filePaths[0] ?? null;
        },
    );
};
