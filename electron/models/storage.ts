import {
    StorageFileIdFormat,
    StorageFolderIdFormat,
} from "../../src/utils/creators";

export interface StorageFolderEntity {
    id: StorageFolderIdFormat;
    name: string;
    path: string;
    size: number;
    vecstore_id?: string;
    created_at: string;
    updated_at: string;
}

export type CreateStorageFolderDto = {
    id: StorageFolderIdFormat;
    name: string;
};

export interface StorageFileEntity {
    id: StorageFileIdFormat;
    folder_id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
}

export type AddStorageFileDto = {
    id: StorageFileIdFormat;
    name: string;
    path: string;
    size: number;
    contentBase64?: string;
};

export type StorageVecstoreEntity = {
    id: string;
    name: string;
    folder_id: string;
    description: string;
    path: string;
    size: number;
    entities_count: number;
    created_at: string;
    updated_at: string;
};

export type CreateStorageVecstoreDto = {
    name: string;
    folder_id: string;
    description?: string;
};

export type RenameStorageVecstoreDto = {
    id: string;
    name: string;
};
