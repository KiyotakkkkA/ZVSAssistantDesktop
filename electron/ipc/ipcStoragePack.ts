import type {
    AddStorageFileDto,
    CreateStorageFolderDto,
} from "../models/storage";
import type { StorageRepository } from "../repositories/StorageRepository";
import { handleManyIpc } from "./ipcUtils";

interface IpcStoragePackDeps {
    storageRepository: StorageRepository;
}

export const registerIpcStoragePack = ({
    storageRepository,
}: IpcStoragePackDeps) => {
    handleManyIpc([
        ["storage:get-folders", () => storageRepository.findAll()],
        ["storage:get-files", () => storageRepository.findAllFiles()],
        [
            "storage:create-folder",
            (payload: CreateStorageFolderDto) =>
                storageRepository.createStorageFolder(payload),
        ],
        [
            "storage:rename-folder",
            (id: string, name: string) => {
                return storageRepository.renameStorageFolder(id, name);
            },
        ],
        [
            "storage:delete-folder",
            (id: string) => {
                storageRepository.deleteStorageFolder(id);
            },
        ],
        [
            "storage:add-files-to-folder",
            (folderId: string, files: AddStorageFileDto[]) => {
                return storageRepository.addFilesToFolder(folderId, files);
            },
        ],
        [
            "storage:remove-files-from-folder",
            (folderId: string, fileIds: string[]) => {
                storageRepository.removeFilesFromFolder(folderId, fileIds);
            },
        ],
        [
            "storage:refresh-folder-content",
            (folderId: string) => {
                return storageRepository.refreshFolderContent(folderId);
            },
        ],
    ]);
};
