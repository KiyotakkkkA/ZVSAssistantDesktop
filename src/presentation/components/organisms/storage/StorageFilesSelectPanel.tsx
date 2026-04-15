import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type {
    StorageFileEntity,
    StorageFolderEntity,
} from "../../../../../electron/models/storage";
import {
    addFilesToFolder,
    createStorageFolder,
    deleteStorageFolder,
    getStorageFiles,
    getStorageFolders,
    refreshFolderContent,
    renameStorageFolder,
} from "../../../../services/storage";
import {
    StorageCreateFolderModal,
    StorageDeleteFolderModal,
    StorageFilesContent,
    StorageFilesSidebar,
    StorageRenameFolderModal,
} from "./files";
import { convertFileToBase64 } from "../../../../utils/converters";

export const StorageFilesSelectPanel = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [folders, setFolders] = useState<StorageFolderEntity[]>([]);
    const [files, setFiles] = useState<StorageFileEntity[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
        null,
    );
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [renameFolderName, setRenameFolderName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(0);

    useEffect(() => {
        let isMounted = true;

        const bootstrapFolders = async () => {
            const [allFolders, allFiles] = await Promise.all([
                getStorageFolders(),
                getStorageFiles(),
            ]);

            if (!isMounted) {
                return;
            }

            setFolders(allFolders);
            setFiles(allFiles);
            setSelectedFolderId(allFolders[0]?.id ?? null);
            setIsLoading(false);
        };

        void bootstrapFolders();

        return () => {
            isMounted = false;
        };
    }, []);

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const selectedFolder =
        folders.find((folder) => folder.id === selectedFolderId) ||
        folders[0] ||
        null;

    const selectedFolderFiles = useMemo(() => {
        if (!selectedFolder) {
            return [];
        }

        return files.filter((file) => file.folder_id === selectedFolder.id);
    }, [files, selectedFolder]);

    const filteredFiles = useMemo(() => {
        if (!normalizedQuery) {
            return selectedFolderFiles;
        }

        return selectedFolderFiles.filter(
            (file) =>
                file.name.toLowerCase().includes(normalizedQuery) ||
                file.path.toLowerCase().includes(normalizedQuery),
        );
    }, [normalizedQuery, selectedFolderFiles]);

    const handleCreateFolder = async () => {
        const name = newFolderName.trim();

        if (!name) {
            return;
        }

        setIsSubmitting(true);

        try {
            const createdFolder = await createStorageFolder({ name });

            setFolders((prev) => {
                const withoutDuplicated = prev.filter(
                    (folder) => folder.id !== createdFolder.id,
                );
                return [createdFolder, ...withoutDuplicated];
            });

            setSelectedFolderId(createdFolder.id);
            setIsCreateModalOpen(false);
            setNewFolderName("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const refreshStorageState = async (preferredFolderId?: string | null) => {
        const [allFolders, allFiles] = await Promise.all([
            getStorageFolders(),
            getStorageFiles(),
        ]);

        setFolders(allFolders);
        setFiles(allFiles);

        const nextSelectedId = preferredFolderId ?? selectedFolderId;

        if (
            nextSelectedId &&
            allFolders.some((item) => item.id === nextSelectedId)
        ) {
            setSelectedFolderId(nextSelectedId);
            return;
        }

        setSelectedFolderId(allFolders[0]?.id ?? null);
    };

    const handleAddFilesClick = () => {
        const input = document.getElementById(
            "storage-files-picker",
        ) as HTMLInputElement | null;

        input?.click();
    };

    const handleAddFilesToFolder = async (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        if (!selectedFolder) {
            return;
        }

        const selectedFiles = event.target.files;

        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = await Promise.all(
                Array.from(selectedFiles).map(async (file) => ({
                    name: file.name,
                    path: (file as File & { path?: string }).path ?? "",
                    size: Number((file.size / (1024 * 1024)).toFixed(4)),
                    contentBase64: await convertFileToBase64(file),
                })),
            );

            await addFilesToFolder(selectedFolder.id, payload);
            await refreshStorageState(selectedFolder.id);
        } finally {
            setFileInputKey((prev) => prev + 1);
            setIsSubmitting(false);
        }
    };

    const handleOpenRenameModal = () => {
        if (!selectedFolder) {
            return;
        }

        setRenameFolderName(selectedFolder.name);
        setIsRenameModalOpen(true);
    };

    const handleRenameFolder = async () => {
        if (!selectedFolder) {
            return;
        }

        const nextName = renameFolderName.trim();

        if (!nextName) {
            return;
        }

        setIsSubmitting(true);

        try {
            const updatedFolder = await renameStorageFolder(
                selectedFolder.id,
                nextName,
            );

            if (!updatedFolder) {
                return;
            }

            setFolders((prev) =>
                prev.map((folder) =>
                    folder.id === updatedFolder.id ? updatedFolder : folder,
                ),
            );

            setIsRenameModalOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!selectedFolder) {
            return;
        }

        const deletedId = selectedFolder.id;

        setIsSubmitting(true);

        try {
            await deleteStorageFolder(deletedId);

            setFolders((prev) => {
                const nextFolders = prev.filter(
                    (folder) => folder.id !== deletedId,
                );

                if (selectedFolderId === deletedId) {
                    setSelectedFolderId(nextFolders[0]?.id ?? null);
                }

                return nextFolders;
            });
            setFiles((prev) =>
                prev.filter((file) => file.folder_id !== deletedId),
            );

            setIsDeleteModalOpen(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenFolderPath = async () => {
        if (!selectedFolder) {
            return;
        }

        await window.core.openPath(selectedFolder.path);
    };

    const handleRefreshFolder = async () => {
        if (!selectedFolder) {
            return;
        }

        setIsSubmitting(true);

        try {
            await refreshFolderContent(selectedFolder.id);
            await refreshStorageState(selectedFolder.id);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="flex h-full min-h-0">
            <input
                id="storage-files-picker"
                key={fileInputKey}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    void handleAddFilesToFolder(event);
                }}
            />

            <StorageFilesSidebar
                isLoading={isLoading}
                searchQuery={searchQuery}
                hasSelectedFolder={Boolean(selectedFolder)}
                folders={folders}
                files={files}
                selectedFolderId={selectedFolder?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateFolder={() => {
                    setIsCreateModalOpen(true);
                }}
                onSelectFolder={setSelectedFolderId}
            />

            <StorageFilesContent
                selectedFolder={selectedFolder}
                selectedFolderFiles={selectedFolderFiles}
                filteredFiles={filteredFiles}
                isSubmitting={isSubmitting}
                onAddFiles={handleAddFilesClick}
                onOpenFolderPath={() => {
                    void handleOpenFolderPath();
                }}
                onRefreshFolder={() => {
                    void handleRefreshFolder();
                }}
                onOpenRenameModal={handleOpenRenameModal}
                onOpenDeleteModal={() => {
                    setIsDeleteModalOpen(true);
                }}
            />

            <StorageCreateFolderModal
                open={isCreateModalOpen}
                isSubmitting={isSubmitting}
                folderName={newFolderName}
                onClose={() => setIsCreateModalOpen(false)}
                onFolderNameChange={setNewFolderName}
                onConfirm={() => {
                    void handleCreateFolder();
                }}
            />

            <StorageRenameFolderModal
                open={isRenameModalOpen}
                isSubmitting={isSubmitting}
                folderName={renameFolderName}
                onClose={() => setIsRenameModalOpen(false)}
                onFolderNameChange={setRenameFolderName}
                onConfirm={() => {
                    void handleRenameFolder();
                }}
            />

            <StorageDeleteFolderModal
                open={isDeleteModalOpen}
                isSubmitting={isSubmitting}
                folderName={selectedFolder?.name || ""}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    void handleDeleteFolder();
                }}
            />
        </section>
    );
};
