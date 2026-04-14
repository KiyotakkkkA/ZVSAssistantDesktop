export interface StorageFolderEntity {
    id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
}

export type CreateStorageFolderDto = {
    name: string;
};

export interface StorageFileEntity {
    id: string;
    folder_id: string;
    name: string;
    path: string;
    size: number;
    created_at: string;
    updated_at: string;
}

export type AddStorageFileDto = {
    name: string;
    path: string;
    size: number;
    contentBase64?: string;
};
