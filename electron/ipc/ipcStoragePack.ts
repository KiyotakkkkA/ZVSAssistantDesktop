import type {
    AddStorageFileDto,
    CreateStorageVecstoreDto,
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
            "storage:get-vectorized-files-by-folder",
            (folderId: string) =>
                storageRepository.findVectorizedFilesByFolderId(folderId),
        ],
        [
            "storage:get-non-vectorized-files-by-folder",
            (folderId: string) =>
                storageRepository.findNonVectorizedFilesByFolderId(folderId),
        ],
        ["storage:get-vecstores", () => storageRepository.findAllVecstores()],
        [
            "storage:refresh-vecstores",
            () => storageRepository.refreshAllVecstores(),
        ],
        [
            "storage:refresh-vecstore-by-id",
            (id: string) => storageRepository.refreshVecstoreById(id),
        ],
        [
            "storage:remove-files-from-vecstore",
            (vecstoreId: string, fileIds: string[]) =>
                storageRepository.removeIndexedFilesFromVecstore(
                    vecstoreId,
                    fileIds,
                ),
        ],
        [
            "storage:create-folder",
            (payload: CreateStorageFolderDto) =>
                storageRepository.createStorageFolder(payload),
        ],
        [
            "storage:create-vecstore",
            (payload: CreateStorageVecstoreDto) =>
                storageRepository.createStorageVecstore(payload),
        ],
        [
            "storage:rename-vecstore",
            (id: string, name: string, description?: string) => {
                return storageRepository.renameStorageVecstore(
                    id,
                    name,
                    description,
                );
            },
        ],
        [
            "storage:delete-vecstore",
            (id: string) => {
                storageRepository.deleteStorageVecstore(id);
            },
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
