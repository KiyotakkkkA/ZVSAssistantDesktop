import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { storageStore } from "../../../../stores/storageStore";
import { StorageVecstoreCreateForm } from "./forms";
import {
    StorageDeleteVecstoreModal,
    StorageRenameVecstoreModal,
    StorageVecstoresSidebar,
    StorageVectstoresContent,
} from "./vecstores";

export const StorageVecstoresSelectPanel = observer(() => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [renameVecstoreName, setRenameVecstoreName] = useState("");
    const [selectedVecstoreId, setSelectedVecstoreId] = useState<string | null>(
        null,
    );
    const createVecstoreFormId = "storage-vecstores-create-form";

    const selectedVecstore =
        storageStore.linkedVecstores.find(
            (vecstore) => vecstore.id === selectedVecstoreId,
        ) ??
        storageStore.linkedVecstores[0] ??
        null;
    const selectedVecstoreFolder = selectedVecstore
        ? (storageStore.folders.find(
              (folder) => folder.id === selectedVecstore.folder_id,
          ) ?? null)
        : null;
    const selectedVecstoreFolderFiles = selectedVecstore
        ? storageStore.getNonVectorizedFilesByFolderId(
              selectedVecstore.folder_id,
          )
        : [];

    const handleCreateVecstore = async (payload: {
        name: string;
        folder_id: string;
        description?: string;
    }) => {
        const created = await storageStore.createVecstore(payload);

        if (!created) {
            return;
        }

        setSelectedVecstoreId(created.id);
        setIsCreateModalOpen(false);
    };

    const handleOpenFolderPath = async () => {
        if (!selectedVecstore) {
            return;
        }

        await window.core.openPath(selectedVecstore.path);
    };

    const handleRefreshVecstore = async () => {
        if (!selectedVecstore) {
            return;
        }

        await storageStore.refreshVecstoreById(selectedVecstore.id);
    };

    const handleOpenRenameModal = () => {
        if (!selectedVecstore) {
            return;
        }

        setRenameVecstoreName(selectedVecstore.name);
        setIsRenameModalOpen(true);
    };

    const handleRenameVecstore = async () => {
        if (!selectedVecstore) {
            return;
        }

        const updated = await storageStore.renameVecstore(
            selectedVecstore.id,
            renameVecstoreName,
        );

        if (!updated) {
            return;
        }

        setIsRenameModalOpen(false);
    };

    const handleDeleteVecstore = async () => {
        if (!selectedVecstore) {
            return;
        }

        await storageStore.deleteVecstore(selectedVecstore.id);
        setIsDeleteModalOpen(false);
    };

    return (
        <>
            <section className="flex h-full">
                <StorageVecstoresSidebar
                    isLoading={storageStore.isLoading}
                    isSubmitting={storageStore.isSubmitting}
                    vecstores={storageStore.linkedVecstores}
                    selectedVecstoreId={selectedVecstore?.id ?? null}
                    onCreateVecstore={() => setIsCreateModalOpen(true)}
                    onFullRefresh={() => {
                        void storageStore.refreshVecstores();
                    }}
                    onSelectVecstore={setSelectedVecstoreId}
                />
                <StorageVectstoresContent
                    selectedVecstore={selectedVecstore}
                    selectedFolder={selectedVecstoreFolder}
                    selectedFolderFiles={selectedVecstoreFolderFiles}
                    isSubmitting={storageStore.isSubmitting}
                    onOpenFolderPath={() => {
                        void handleOpenFolderPath();
                    }}
                    onRefreshVecstore={() => {
                        void handleRefreshVecstore();
                    }}
                    onOpenRenameModal={handleOpenRenameModal}
                    onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
                />
            </section>

            <Modal
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Создать векторное хранилище"
                className="max-w-xl"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setIsCreateModalOpen(false)}
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
                    isSubmitting={storageStore.isSubmitting}
                    onSubmit={(payload) => {
                        void handleCreateVecstore(payload);
                    }}
                />
            </Modal>

            <StorageRenameVecstoreModal
                open={isRenameModalOpen}
                isSubmitting={storageStore.isSubmitting}
                vecstoreName={renameVecstoreName}
                onClose={() => setIsRenameModalOpen(false)}
                onVecstoreNameChange={setRenameVecstoreName}
                onConfirm={() => {
                    void handleRenameVecstore();
                }}
            />

            <StorageDeleteVecstoreModal
                open={isDeleteModalOpen}
                isSubmitting={storageStore.isSubmitting}
                vecstoreName={selectedVecstore?.name ?? ""}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    void handleDeleteVecstore();
                }}
            />
        </>
    );
});
