import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { observer } from "mobx-react-lite";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import {
    StorageCreateFolderModal,
    StorageFilesContent,
    StorageFilesSidebar,
    StorageRenameFolderModal,
} from "./files";
import { StorageVecstoreCreateForm } from "./forms";
import { convertFileToBase64 } from "../../../../utils/converters";
import { storageStore } from "../../../../stores/storageStore";
import {
    createStorageFileId,
    type StorageFolderIdFormat,
} from "../../../../utils/creators";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../../../../data/MsgToasts";

export const StorageFilesSelectPanel = observer(() => {
    const toast = useToasts();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [renameFolderName, setRenameFolderName] = useState("");
    const [isCreateVecstoreModalOpen, setIsCreateVecstoreModalOpen] =
        useState(false);
    const [fixedVecstoreFolderId, setFixedVecstoreFolderId] = useState<
        string | null
    >(null);
    const [selectedFolderId, setSelectedFolderId] =
        useState<StorageFolderIdFormat | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);
    const createVecstoreFormId = "storage-files-create-vecstore-form";
    const folders = storageStore.folders;
    const files = storageStore.files;

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const selectedFolder = useMemo(() => {
        if (!selectedFolderId) {
            return folders[0] ?? null;
        }

        return (
            folders.find((folder) => folder.id === selectedFolderId) ??
            folders[0] ??
            null
        );
    }, [folders, selectedFolderId]);

    const selectedFolderFiles = useMemo(() => {
        if (!selectedFolder) {
            return [];
        }

        return files.filter((file) => file.folder_id === selectedFolder.id);
    }, [files, selectedFolder]);

    useEffect(() => {
        if (folders.length === 0) {
            if (selectedFolderId !== null) {
                setSelectedFolderId(null);
            }
            return;
        }

        if (
            !selectedFolderId ||
            !folders.some((folder) => folder.id === selectedFolderId)
        ) {
            setSelectedFolderId(folders[0].id);
        }
    }, [folders, selectedFolderId]);

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
        const createdFolder = await storageStore.createFolder(newFolderName);

        if (!createdFolder) {
            return;
        }

        setSelectedFolderId(createdFolder.id);
        setIsCreateModalOpen(false);
        setNewFolderName("");
        toast.success(MsgToasts.FOLDER_SUCCESSFULLY_CREATED());
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

        try {
            const payload = await Promise.all(
                Array.from(selectedFiles).map(async (file) => {
                    const nativePath =
                        (file as File & { path?: string }).path ?? "";

                    return {
                        id: createStorageFileId(nativePath || file.name),
                        name: file.name,
                        path: nativePath,
                        size: Number((file.size / (1024 * 1024)).toFixed(4)),
                        contentBase64: await convertFileToBase64(file),
                    };
                }),
            );

            await storageStore.addFilesToFolderById(selectedFolder.id, payload);
        } finally {
            setFileInputKey((prev) => prev + 1);
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

        const updatedFolder = await storageStore.renameFolderById(
            selectedFolder.id,
            renameFolderName,
        );

        if (!updatedFolder) {
            return;
        }

        setIsRenameModalOpen(false);
        toast.success(MsgToasts.FOLDER_SUCCESSFULLY_RENAMED());
    };

    const handleDeleteFolder = async () => {
        if (!selectedFolder) {
            return;
        }

        await storageStore.deleteFolderById(selectedFolder.id);
        toast.success(MsgToasts.FOLDER_SUCCESSFULLY_REMOVED());
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

        await storageStore.refreshFolderById(selectedFolder.id);
    };

    const handleCreateVecstore = async (payload: {
        name: string;
        folder_id: string;
        description?: string;
    }) => {
        const created = await storageStore.createVecstore(payload);

        if (!created) {
            return;
        }

        setIsCreateVecstoreModalOpen(false);
        setFixedVecstoreFolderId(null);
        toast.success(MsgToasts.VSTORE_SUCCESSFULLY_CREATED());
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
                isLoading={storageStore.isLoading}
                isSubmitting={storageStore.isSubmitting}
                searchQuery={searchQuery}
                hasSelectedFolder={Boolean(selectedFolder)}
                folders={folders}
                files={files}
                selectedFolderId={selectedFolder?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateFolder={() => {
                    setIsCreateModalOpen(true);
                }}
                onFullRefresh={() => {
                    void storageStore.refreshStorageState();
                }}
                onSelectFolder={(folderId) => {
                    setSelectedFolderId(folderId as StorageFolderIdFormat);
                }}
            />

            <StorageFilesContent
                selectedFolder={selectedFolder}
                selectedFolderFiles={selectedFolderFiles}
                filteredFiles={filteredFiles}
                isSubmitting={storageStore.isSubmitting}
                onAddFiles={handleAddFilesClick}
                onOpenFolderPath={() => {
                    void handleOpenFolderPath();
                }}
                onRefreshFolder={() => {
                    void handleRefreshFolder();
                }}
                onOpenRenameModal={handleOpenRenameModal}
                onCreateVecstoreOnFolder={(folderId) => {
                    setFixedVecstoreFolderId(folderId);
                    setIsCreateVecstoreModalOpen(true);
                }}
                onDeleteFolder={() => {
                    void handleDeleteFolder();
                }}
            />

            <Modal
                open={isCreateVecstoreModalOpen}
                onClose={() => {
                    setIsCreateVecstoreModalOpen(false);
                    setFixedVecstoreFolderId(null);
                }}
                className="max-w-xl"
            >
                <Modal.Header className="text-main-100">
                    Создать векторное хранилище
                </Modal.Header>

                <Modal.Content>
                    <StorageVecstoreCreateForm
                        folders={storageStore.folders}
                        formId={createVecstoreFormId}
                        fixedFolderId={fixedVecstoreFolderId}
                        isSubmitting={storageStore.isSubmitting}
                        onSubmit={handleCreateVecstore}
                    />
                </Modal.Content>

                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                setIsCreateVecstoreModalOpen(false);
                                setFixedVecstoreFolderId(null);
                            }}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            form={createVecstoreFormId}
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            disabled={storageStore.isSubmitting}
                        >
                            Создать
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            <StorageCreateFolderModal
                open={isCreateModalOpen}
                isSubmitting={storageStore.isSubmitting}
                folderName={newFolderName}
                onClose={() => setIsCreateModalOpen(false)}
                onFolderNameChange={setNewFolderName}
                onConfirm={() => {
                    void handleCreateFolder();
                }}
            />

            <StorageRenameFolderModal
                open={isRenameModalOpen}
                isSubmitting={storageStore.isSubmitting}
                folderName={renameFolderName}
                onClose={() => setIsRenameModalOpen(false)}
                onFolderNameChange={setRenameFolderName}
                onConfirm={() => {
                    void handleRenameFolder();
                }}
            />
        </section>
    );
});
