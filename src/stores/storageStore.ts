import { action, makeAutoObservable, runInAction } from "mobx";
import type {
    AddStorageFileDto,
    CreateStorageVecstoreDto,
    StorageFileEntity,
    StorageFolderEntity,
    StorageVecstoreEntity,
} from "../../electron/models/storage";
import {
    addFilesToFolder,
    createStorageVecstore,
    createStorageFolder,
    deleteStorageVecstore,
    deleteStorageFolder,
    getStorageFiles,
    getStorageFolders,
    getStorageVecstores,
    refreshStorageVecstores,
    refreshStorageVecstoreById,
    removeFilesFromVecstore,
    refreshFolderContent,
    removeFilesFromFolder,
    renameStorageVecstore,
    renameStorageFolder,
} from "../services/storage";
import { createStorageFolderId } from "../utils/creators";

class StorageStore {
    folders: StorageFolderEntity[] = [];
    files: StorageFileEntity[] = [];
    vecstores: StorageVecstoreEntity[] = [];
    selectedFolderId: string | null = null;

    isLoading = false;
    isSubmitting = false;
    isBootstrapped = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(
            this,
            {
                bootstrap: action.bound,
                refreshStorageState: action.bound,
                selectFolder: action.bound,
                createFolder: action.bound,
                renameSelectedFolder: action.bound,
                deleteSelectedFolder: action.bound,
                createVecstore: action.bound,
                renameVecstore: action.bound,
                deleteVecstore: action.bound,
                addFilesToSelectedFolder: action.bound,
                removeFilesFromSelectedFolder: action.bound,
                refreshSelectedFolder: action.bound,
                getVectorizedFilesByFolderId: action.bound,
                getNonVectorizedFilesByFolderId: action.bound,
                refreshVecstores: action.bound,
                refreshVecstoreById: action.bound,
                removeIndexedFilesFromVecstore: action.bound,
            },
            { autoBind: true },
        );
    }

    private resolveFolderSize(folderFiles: StorageFileEntity[]) {
        return Number(
            folderFiles
                .reduce((total, file) => total + file.size, 0)
                .toFixed(4),
        );
    }

    private async refreshFolderState(folderId: string) {
        const refreshedFiles = await refreshFolderContent(folderId);

        runInAction(() => {
            this.files = [
                ...this.files.filter((file) => file.folder_id !== folderId),
                ...refreshedFiles,
            ];

            this.folders = this.folders.map((folder) =>
                folder.id === folderId
                    ? {
                          ...folder,
                          size: this.resolveFolderSize(refreshedFiles),
                          updated_at: new Date().toISOString(),
                      }
                    : folder,
            );
        });
    }

    get selectedFolder(): StorageFolderEntity | null {
        return (
            this.folders.find(
                (folder) => folder.id === this.selectedFolderId,
            ) ??
            this.folders[0] ??
            null
        );
    }

    get selectedFolderFiles(): StorageFileEntity[] {
        if (!this.selectedFolder) {
            return [];
        }

        return this.files.filter(
            (file) => file.folder_id === this.selectedFolder?.id,
        );
    }

    getVectorizedFilesByFolderId(folderId: string): StorageFileEntity[] {
        return this.files.filter(
            (file) => file.folder_id === folderId && Boolean(file.vecstore_id),
        );
    }

    getNonVectorizedFilesByFolderId(folderId: string): StorageFileEntity[] {
        return this.files.filter(
            (file) => file.folder_id === folderId && !file.vecstore_id,
        );
    }

    get linkedVecstores(): StorageVecstoreEntity[] {
        const linkedIds = new Set(
            this.folders.map((folder) => folder.vecstore_id).filter(Boolean),
        );

        return this.vecstores.filter((vecstore) => linkedIds.has(vecstore.id));
    }

    async refreshVecstores() {
        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const refreshedVecstores = await refreshStorageVecstores();

            runInAction(() => {
                this.vecstores = refreshedVecstores;
            });
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async refreshVecstoreById(id: string) {
        if (!id.trim()) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const refreshed = await refreshStorageVecstoreById(id);

            if (!refreshed) {
                return null;
            }

            runInAction(() => {
                this.vecstores = this.vecstores.map((vecstore) =>
                    vecstore.id === refreshed.id ? refreshed : vecstore,
                );
            });

            return refreshed;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async removeIndexedFilesFromVecstore(
        vecstoreId: string,
        fileIds: string[],
    ) {
        if (!vecstoreId.trim()) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const result = await removeFilesFromVecstore(vecstoreId, fileIds);
            await this.refreshStorageState();
            return result;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async bootstrap() {
        if (this.isLoading) {
            return;
        }

        runInAction(() => {
            this.isLoading = true;
            this.error = null;
        });

        try {
            const [allFolders, allFiles, allVecstores] = await Promise.all([
                getStorageFolders(),
                getStorageFiles(),
                getStorageVecstores(),
            ]);

            runInAction(() => {
                this.folders = allFolders;
                this.files = allFiles;
                this.vecstores = allVecstores;

                if (
                    this.selectedFolderId &&
                    allFolders.some(
                        (folder) => folder.id === this.selectedFolderId,
                    )
                ) {
                    return;
                }

                this.selectedFolderId = allFolders[0]?.id ?? null;
            });
        } catch (error) {
            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to load storage data";
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
                this.isBootstrapped = true;
            });
        }
    }

    async refreshStorageState() {
        const [allFolders, allFiles, allVecstores] = await Promise.all([
            getStorageFolders(),
            getStorageFiles(),
            getStorageVecstores(),
        ]);

        runInAction(() => {
            this.folders = allFolders;
            this.files = allFiles;
            this.vecstores = allVecstores;

            if (
                this.selectedFolderId &&
                allFolders.some((folder) => folder.id === this.selectedFolderId)
            ) {
                return;
            }

            this.selectedFolderId = allFolders[0]?.id ?? null;
        });
    }

    selectFolder(folderId: string) {
        this.selectedFolderId = folderId;
    }

    async createFolder(name: string) {
        const normalizedName = name.trim();

        if (!normalizedName) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const createdFolder = await createStorageFolder({
                id: createStorageFolderId(),
                name: normalizedName,
            });

            runInAction(() => {
                this.folders = [createdFolder, ...this.folders];
                this.selectedFolderId = createdFolder.id;
            });

            return createdFolder;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async renameSelectedFolder(name: string) {
        const folder = this.selectedFolder;
        const normalizedName = name.trim();

        if (!folder || !normalizedName) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const updatedFolder = await renameStorageFolder(
                folder.id,
                normalizedName,
            );

            if (!updatedFolder) {
                return null;
            }

            runInAction(() => {
                this.folders = this.folders.map((item) =>
                    item.id === updatedFolder.id ? updatedFolder : item,
                );
            });

            return updatedFolder;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async deleteSelectedFolder() {
        const folder = this.selectedFolder;

        if (!folder) {
            return;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const deletedFolderId = folder.id;

            await deleteStorageFolder(folder.id);

            runInAction(() => {
                this.folders = this.folders.filter(
                    (item) => item.id !== deletedFolderId,
                );
                this.files = this.files.filter(
                    (file) => file.folder_id !== deletedFolderId,
                );
                this.vecstores = this.vecstores.filter(
                    (vecstore) => vecstore.folder_id !== deletedFolderId,
                );

                if (this.selectedFolderId === deletedFolderId) {
                    this.selectedFolderId = this.folders[0]?.id ?? null;
                }
            });
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async createVecstore(payload: CreateStorageVecstoreDto) {
        const normalizedName = payload.name.trim();

        if (!normalizedName || !payload.folder_id.trim()) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const created = await createStorageVecstore({
                ...payload,
                name: normalizedName,
            });

            runInAction(() => {
                this.vecstores = [created, ...this.vecstores];
                this.folders = this.folders.map((folder) =>
                    folder.id === created.folder_id
                        ? {
                              ...folder,
                              vecstore_id: created.id,
                              updated_at: created.updated_at,
                          }
                        : folder,
                );
            });

            return created;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async renameVecstore(id: string, name: string) {
        const normalizedName = name.trim();

        if (!id.trim() || !normalizedName) {
            return null;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            const updated = await renameStorageVecstore(id, normalizedName);

            if (!updated) {
                return null;
            }

            runInAction(() => {
                this.vecstores = this.vecstores.map((vecstore) =>
                    vecstore.id === updated.id ? updated : vecstore,
                );

                this.folders = this.folders.map((folder) =>
                    folder.id === updated.folder_id
                        ? {
                              ...folder,
                              updated_at: updated.updated_at,
                          }
                        : folder,
                );
            });

            return updated;
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async deleteVecstore(id: string) {
        if (!id.trim()) {
            return;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            await deleteStorageVecstore(id);

            runInAction(() => {
                this.vecstores = this.vecstores.filter(
                    (vecstore) => vecstore.id !== id,
                );

                this.folders = this.folders.map((folder) =>
                    folder.vecstore_id === id
                        ? {
                              ...folder,
                              vecstore_id: undefined,
                              updated_at: new Date().toISOString(),
                          }
                        : folder,
                );
            });
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async addFilesToSelectedFolder(files: AddStorageFileDto[]) {
        const folder = this.selectedFolder;

        if (!folder || files.length === 0) {
            return;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            await addFilesToFolder(folder.id, files);
            await this.refreshFolderState(folder.id);
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async removeFilesFromSelectedFolder(fileIds: string[]) {
        const folder = this.selectedFolder;

        if (!folder || fileIds.length === 0) {
            return;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            await removeFilesFromFolder(folder.id, fileIds);
            await this.refreshFolderState(folder.id);
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }

    async refreshSelectedFolder() {
        const folder = this.selectedFolder;

        if (!folder) {
            return;
        }

        runInAction(() => {
            this.isSubmitting = true;
        });

        try {
            await this.refreshFolderState(folder.id);
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }
}

export const storageStore = new StorageStore();
