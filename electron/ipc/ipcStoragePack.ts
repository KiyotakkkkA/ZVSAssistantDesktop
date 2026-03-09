import type { DatabaseService } from "../services/storage/DatabaseService";
import type { FileStorageService } from "../services/storage/FileStorageService";
import type { FSystemService } from "../services/FSystemService";
import type {
    AppCacheEntry,
    UploadedFileData,
} from "../../src/types/ElectronApi";
import { handleIpc, handleManyIpc } from "./ipcUtils";

export type IpcStoragePackDeps = {
    databaseService: DatabaseService;
    fileStorageService: FileStorageService;
    fSystemService: FSystemService;
};

export const registerIpcStoragePack = ({
    databaseService,
    fileStorageService,
    fSystemService,
}: IpcStoragePackDeps) => {
    handleManyIpc([
        [
            "app:save-files",
            (files: UploadedFileData[]) => fileStorageService.saveFiles(files),
        ],
        [
            "app:get-files-by-ids",
            (fileIds: string[]) => fileStorageService.getFilesByIds(fileIds),
        ],
        ["app:get-all-files", () => fileStorageService.getAllFiles()],
        [
            "app:delete-file",
            (fileId: string) => fileStorageService.deleteFileById(fileId),
        ],
        [
            "app:get-cache-entry",
            (key: string) =>
                databaseService.getCacheEntry(key) as AppCacheEntry | null,
        ],
        [
            "app:set-cache-entry",
            (key: string, entry: AppCacheEntry) => {
                databaseService.setCacheEntry(key, entry);
            },
        ],
    ]);

    handleIpc("app:fs-list-directory", (cwd: string) =>
        fSystemService.listDirectory(cwd),
    );

    handleIpc(
        "app:fs-create-file",
        async (cwd: string, filename: string, content: string = "") =>
            fSystemService.createFile(cwd, filename, content),
    );

    handleIpc("app:fs-create-dir", (cwd: string, dirname: string) =>
        fSystemService.createDir(cwd, dirname),
    );

    handleIpc(
        "app:fs-read-file",
        (
            filePath: string,
            readAll: boolean,
            fromLine?: number,
            toLine?: number,
        ) =>
            fSystemService.readTextFileRange(
                filePath,
                readAll,
                fromLine,
                toLine,
            ),
    );
};
