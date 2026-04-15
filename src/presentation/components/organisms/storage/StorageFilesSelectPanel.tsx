import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { observer } from "mobx-react-lite";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import {
    StorageCreateFolderModal,
    StorageDeleteFolderModal,
    StorageFilesContent,
    StorageFilesSidebar,
    StorageRenameFolderModal,
} from "./files";
import { StorageVecstoreCreateForm } from "./forms";
import { convertFileToBase64 } from "../../../../utils/converters";
import { storageStore } from "../../../../stores/storageStore";
import { createStorageFileId } from "../../../../utils/creators";

export const StorageFilesSelectPanel = observer(() => {
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [renameFolderName, setRenameFolderName] = useState("");
    const [isCreateVecstoreModalOpen, setIsCreateVecstoreModalOpen] =
        useState(false);
    const [fixedVecstoreFolderId, setFixedVecstoreFolderId] = useState<
        string | null
    >(null);
    const [fileInputKey, setFileInputKey] = useState(0);
    const createVecstoreFormId = "storage-files-create-vecstore-form";

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const selectedFolder = storageStore.selectedFolder;
    const selectedFolderFiles = storageStore.selectedFolderFiles;

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

        setIsCreateModalOpen(false);
        setNewFolderName("");
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
                Array.from(selectedFiles).map(async (file) => ({
                    id: createStorageFileId(file.name),
                    name: file.name,
                    path: (file as File & { path?: string }).path ?? "",
                    size: Number((file.size / (1024 * 1024)).toFixed(4)),
                    contentBase64: await convertFileToBase64(file),
                })),
            );

            await storageStore.addFilesToSelectedFolder(payload);
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
        const updatedFolder =
            await storageStore.renameSelectedFolder(renameFolderName);

        if (!updatedFolder) {
            return;
        }

        setIsRenameModalOpen(false);
    };

    const handleDeleteFolder = async () => {
        await storageStore.deleteSelectedFolder();
        setIsDeleteModalOpen(false);
    };

    const handleOpenFolderPath = async () => {
        if (!selectedFolder) {
            return;
        }

        await window.core.openPath(selectedFolder.path);
    };

    const handleRefreshFolder = async () => {
        await storageStore.refreshSelectedFolder();
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
                folders={storageStore.folders}
                files={storageStore.files}
                selectedFolderId={selectedFolder?.id ?? null}
                onSearchQueryChange={setSearchQuery}
                onCreateFolder={() => {
                    setIsCreateModalOpen(true);
                }}
                onFullRefresh={() => {
                    void storageStore.refreshStorageState();
                }}
                onSelectFolder={storageStore.selectFolder}
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
                onOpenDeleteModal={() => {
                    setIsDeleteModalOpen(true);
                }}
            />

            <Modal
                open={isCreateVecstoreModalOpen}
                onClose={() => {
                    setIsCreateVecstoreModalOpen(false);
                    setFixedVecstoreFolderId(null);
                }}
                title="Создать векторное хранилище"
                className="max-w-xl"
                footer={
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
                }
            >
                <StorageVecstoreCreateForm
                    folders={storageStore.folders}
                    formId={createVecstoreFormId}
                    fixedFolderId={fixedVecstoreFolderId}
                    isSubmitting={storageStore.isSubmitting}
                    onSubmit={(payload) => {
                        void handleCreateVecstore(payload);
                    }}
                />
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

            <StorageDeleteFolderModal
                open={isDeleteModalOpen}
                isSubmitting={storageStore.isSubmitting}
                folderName={selectedFolder?.name || ""}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    void handleDeleteFolder();
                }}
            />
        </section>
    );
});
