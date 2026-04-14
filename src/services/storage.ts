import type {
    AddStorageFileDto,
    CreateStorageFolderDto,
    StorageFileEntity,
    StorageFolderEntity,
} from "../../electron/models/storage";

export const getStorageFolders = async (): Promise<StorageFolderEntity[]> => {
    return window.storage.getStorageFolders();
};

export const getStorageFiles = async (): Promise<StorageFileEntity[]> => {
    return window.storage.getStorageFiles();
};

export const createStorageFolder = async (
    payload: CreateStorageFolderDto,
): Promise<StorageFolderEntity> => {
    return window.storage.createStorageFolder(payload);
};

export const renameStorageFolder = async (
    id: string,
    name: string,
): Promise<StorageFolderEntity | null> => {
    return window.storage.renameStorageFolder(id, name);
};

export const deleteStorageFolder = async (id: string): Promise<void> => {
    return window.storage.deleteStorageFolder(id);
};

export const addFilesToFolder = async (
    folderId: string,
    files: AddStorageFileDto[],
): Promise<StorageFileEntity[]> => {
    return window.storage.addFilesToFolder(folderId, files);
};

export const removeFilesFromFolder = async (
    folderId: string,
    fileIds: string[],
): Promise<void> => {
    return window.storage.removeFilesFromFolder(folderId, fileIds);
};

export const refreshFolderContent = async (
    folderId: string,
): Promise<StorageFileEntity[]> => {
    return window.storage.refreshFolderContent(folderId);
};
