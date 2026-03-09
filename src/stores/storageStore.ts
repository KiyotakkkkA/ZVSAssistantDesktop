import { makeAutoObservable, runInAction } from "mobx";
import type {
    SavedFileRecord,
    VectorTagRecord,
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
    vectorTags: VectorTagRecord[] = [];
    selectedVectorStorageId: string | null = null;
    projectRefByFileId: Record<string, StorageFileProjectRef> = {};

    private isLoadingFiles = false;

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

    setVectorStoragesData(nextVectorStorages: VectorStorageRecord[]): void {
        const normalized = Array.isArray(nextVectorStorages)
            ? nextVectorStorages
            : [];

        this.vectorStorages = normalized;

        if (
            this.selectedVectorStorageId &&
            normalized.some(
                (vectorStorage) =>
                    vectorStorage.id === this.selectedVectorStorageId,
            )
        ) {
            return;
        }

        this.selectedVectorStorageId = normalized[0]?.id ?? null;
    }

    setVectorTagsData(nextVectorTags: VectorTagRecord[]): void {
        this.vectorTags = Array.isArray(nextVectorTags) ? nextVectorTags : [];
    }

    setSelectedFileId(fileId: string): void {
        this.selectedFileId = fileId;
    }

    setSelectedVectorStorageId(vectorStorageId: string): void {
        this.selectedVectorStorageId = vectorStorageId;
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
