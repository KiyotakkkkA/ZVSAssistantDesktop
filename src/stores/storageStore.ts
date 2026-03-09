import { makeAutoObservable, runInAction } from "mobx";
import type {
    SavedFileRecord,
    UpdateVectorStoragePayload,
    VectorStorageRecord,
} from "../types/ElectronApi";

export type StorageFileProjectRef = {
    id: string;
    title: string;
};

class StorageStore {
    isFilesLoading = false;
    isVectorStoragesLoading = false;
    files: SavedFileRecord[] = [];
    selectedFileId: string | null = null;
    vectorStorages: VectorStorageRecord[] = [];
    selectedVectorStorageId: string | null = null;
    projectRefByFileId: Record<string, StorageFileProjectRef> = {};

    private isLoadingFiles = false;
    private isLoadingVectorStorages = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async loadFilesData(): Promise<void> {
        if (this.isLoadingFiles) {
            return;
        }

        this.isLoadingFiles = true;

        runInAction(() => {
            this.isFilesLoading = true;
        });

        try {
            const api = window.appApi;

            if (!api) {
                runInAction(() => {
                    this.files = [];
                    this.projectRefByFileId = {};
                    this.selectedFileId = null;
                });
                return;
            }

            const [storedFiles, projectsList] = await Promise.all([
                api.files.getAllFiles(),
                api.projects.getProjectsList(),
            ]);
            const projects = await Promise.all(
                projectsList.map((project) =>
                    api.projects.getProjectById(project.id),
                ),
            );

            const nextProjectRefByFileId: Record<
                string,
                StorageFileProjectRef
            > = {};

            for (const project of projects) {
                if (!project) {
                    continue;
                }

                for (const fileId of project.fileUUIDs) {
                    nextProjectRefByFileId[fileId] = {
                        id: project.id,
                        title: project.name,
                    };
                }
            }

            runInAction(() => {
                this.files = storedFiles;
                this.projectRefByFileId = nextProjectRefByFileId;

                if (
                    this.selectedFileId &&
                    storedFiles.some((file) => file.id === this.selectedFileId)
                ) {
                    return;
                }

                this.selectedFileId = storedFiles[0]?.id ?? null;
            });
        } finally {
            runInAction(() => {
                this.isFilesLoading = false;
            });

            this.isLoadingFiles = false;
        }
    }

    async loadVectorStoragesData(): Promise<void> {
        if (this.isLoadingVectorStorages) {
            return;
        }

        this.isLoadingVectorStorages = true;

        runInAction(() => {
            this.isVectorStoragesLoading = true;
        });

        try {
            const api = window.appApi;

            if (!api) {
                runInAction(() => {
                    this.vectorStorages = [];
                    this.selectedVectorStorageId = null;
                });
                return;
            }

            const nextVectorStorages =
                await api.vectorStorages.getVectorStorages();

            runInAction(() => {
                this.vectorStorages = nextVectorStorages;

                if (
                    this.selectedVectorStorageId &&
                    nextVectorStorages.some(
                        (vectorStorage) =>
                            vectorStorage.id === this.selectedVectorStorageId,
                    )
                ) {
                    return;
                }

                this.selectedVectorStorageId =
                    nextVectorStorages[0]?.id ?? null;
            });
        } finally {
            runInAction(() => {
                this.isVectorStoragesLoading = false;
            });

            this.isLoadingVectorStorages = false;
        }
    }

    setSelectedFileId(fileId: string): void {
        this.selectedFileId = fileId;
    }

    setSelectedVectorStorageId(vectorStorageId: string): void {
        this.selectedVectorStorageId = vectorStorageId;
    }

    async updateVectorStorage(
        vectorStorageId: string,
        payload: UpdateVectorStoragePayload,
    ): Promise<VectorStorageRecord | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const updatedVectorStorage =
            await api.vectorStorages.updateVectorStorage(
                vectorStorageId,
                payload,
            );

        if (!updatedVectorStorage) {
            return null;
        }

        runInAction(() => {
            this.vectorStorages = this.vectorStorages.map((vectorStorage) =>
                vectorStorage.id === updatedVectorStorage.id
                    ? updatedVectorStorage
                    : vectorStorage,
            );
        });

        return updatedVectorStorage;
    }

    get selectedFile(): SavedFileRecord | null {
        if (!this.selectedFileId) {
            return null;
        }

        return (
            this.files.find((file) => file.id === this.selectedFileId) ?? null
        );
    }

    get selectedFileProjectRef(): StorageFileProjectRef | undefined {
        if (!this.selectedFile) {
            return undefined;
        }

        return this.projectRefByFileId[this.selectedFile.id];
    }

    get selectedVectorStorage(): VectorStorageRecord | null {
        if (!this.selectedVectorStorageId) {
            return null;
        }

        return (
            this.vectorStorages.find(
                (vectorStorage) =>
                    vectorStorage.id === this.selectedVectorStorageId,
            ) ?? null
        );
    }
}

export const storageStore = new StorageStore();
