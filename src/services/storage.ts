import type {
    AddStorageFileDto,
    CreateStorageVecstoreDto,
    CreateStorageFolderDto,
    StorageFileEntity,
    StorageFolderEntity,
    StorageVecstoreEntity,
} from "../../electron/models/storage";

export const getStorageFolders = async (): Promise<StorageFolderEntity[]> => {
    return window.storage.getStorageFolders();
};

export const getStorageFiles = async (): Promise<StorageFileEntity[]> => {
    return window.storage.getStorageFiles();
};

export const getVectorizedFilesByFolder = async (
    folderId: string,
): Promise<StorageFileEntity[]> => {
    return window.storage.getVectorizedFilesByFolder(folderId);
};

export const getNonVectorizedFilesByFolder = async (
    folderId: string,
): Promise<StorageFileEntity[]> => {
    return window.storage.getNonVectorizedFilesByFolder(folderId);
};

export const getStorageVecstores = async (): Promise<
    StorageVecstoreEntity[]
> => {
    return window.storage.getStorageVecstores();
};

export const refreshStorageVecstores = async (): Promise<
    StorageVecstoreEntity[]
> => {
    return window.storage.refreshStorageVecstores();
};

export const refreshStorageVecstoreById = async (
    id: string,
): Promise<StorageVecstoreEntity | null> => {
    return window.storage.refreshStorageVecstoreById(id);
};

export const createStorageFolder = async (
    payload: CreateStorageFolderDto,
): Promise<StorageFolderEntity> => {
    return window.storage.createStorageFolder(payload);
};

export const createStorageVecstore = async (
    payload: CreateStorageVecstoreDto,
): Promise<StorageVecstoreEntity> => {
    return window.storage.createStorageVecstore(payload);
};

export const renameStorageVecstore = async (
    id: string,
    name: string,
): Promise<StorageVecstoreEntity | null> => {
    return window.storage.renameStorageVecstore(id, name);
};

export const deleteStorageVecstore = async (id: string): Promise<void> => {
    return window.storage.deleteStorageVecstore(id);
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
