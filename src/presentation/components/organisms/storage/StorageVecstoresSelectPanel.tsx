import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useJobs } from "../../../../hooks";
import { storageStore } from "../../../../stores/storageStore";
import { StorageVecstoresSidebar, StorageVectstoresContent } from "./vecstores";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../../../../data/MsgToasts";
import {
    StorageIndexingProgressForm,
    StorageVecstoreManagingForm,
} from "../forms";
import type {
    CreateStorageVecstoreDto,
    UpdateStorageVecstoreDto,
} from "../../../../../electron/models/storage";

export const StorageVecstoresSelectPanel = observer(() => {
    const {
        createJob,
        cancelJobById,
        getJobById,
        selectedJobEvents,
        selectedJobId,
        selectJob,
    } = useJobs();
    const toast = useToasts();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isIndexingModalOpen, setIsIndexingModalOpen] = useState(false);
    const [createVecstoreModel, setCreateVecstoreModel] =
        useState<CreateStorageVecstoreDto>({
            name: "",
            folder_id: "",
            description: "",
        });
    const [updateVecstoreModel, setUpdateVecstoreModel] =
        useState<UpdateStorageVecstoreDto>({
            id: "",
            name: "",
            description: "",
        });
    const [selectedVecstoreId, setSelectedVecstoreId] = useState<string | null>(
        null,
    );
    const [indexingJobId, setIndexingJobId] = useState<string | null>(null);
    const [syncedCompletedJobIds, setSyncedCompletedJobIds] = useState<
        string[]
    >([]);
    const createVecstoreFormId = "storage-vecstores-create-form";
    const updateVecstoreFormId = "storage-vecstores-update-form";

    const resolveCreateFolderId = () => {
        return (
            storageStore.folders.find((folder) => !folder.vecstore_id)?.id ??
            storageStore.folders[0]?.id ??
            ""
        );
    };

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
    const selectedVecstoreNonVectorizedFiles = selectedVecstore
        ? storageStore.getNonVectorizedFilesByFolderId(
              selectedVecstore.folder_id,
          )
        : [];
    const selectedVecstoreVectorizedFiles = selectedVecstore
        ? storageStore.getVectorizedFilesByFolderId(selectedVecstore.folder_id)
        : [];

    const indexingJob = indexingJobId ? getJobById(indexingJobId) : null;
    const indexingEvents =
        indexingJobId && selectedJobId === indexingJobId
            ? selectedJobEvents
            : [];

    useEffect(() => {
        if (!indexingJobId) {
            return;
        }

        selectJob(indexingJobId);
    }, [indexingJobId, selectJob]);

    useEffect(() => {
        if (!indexingJobId || !indexingJob || indexingJob.isPending) {
            return;
        }

        if (syncedCompletedJobIds.includes(indexingJobId)) {
            return;
        }

        setSyncedCompletedJobIds((prev) => [...prev, indexingJobId]);
        void storageStore.refreshStorageState();
    }, [indexingJob, indexingJobId, syncedCompletedJobIds]);

    const handleCreateVecstore = async (payload: CreateStorageVecstoreDto) => {
        const created = await storageStore.createVecstore(payload);

        if (!created) {
            return;
        }

        setSelectedVecstoreId(created.id);
        setIsCreateModalOpen(false);
        toast.success(MsgToasts.VSTORE_SUCCESSFULLY_CREATED());
    };

    const handleUpdateVecstore = async (payload: UpdateStorageVecstoreDto) => {
        const updated = await storageStore.updateVecstore(payload);

        if (!updated) {
            return;
        }

        setIsUpdateModalOpen(false);
        toast.success(MsgToasts.VSTORE_SUCCESSFULLY_CHANGED());
        return;
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

    const handleOpenUpdateModal = () => {
        if (!selectedVecstore) {
            return;
        }

        setUpdateVecstoreModel({
            id: selectedVecstore.id,
            name: selectedVecstore.name,
            description: selectedVecstore.description ?? "",
        });
        setIsUpdateModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setCreateVecstoreModel({
            name: "",
            folder_id: resolveCreateFolderId(),
            description: "",
        });
        setIsCreateModalOpen(true);
    };

    const handleDeleteVecstore = async () => {
        if (!selectedVecstore) {
            return;
        }

        await storageStore.deleteVecstore(selectedVecstore.id);
        toast.success(MsgToasts.VSTORE_SUCCESSFULLY_REMOVED());
    };

    const handleAddToIndex = async (fileIds: string[]) => {
        if (!selectedVecstore) {
            return;
        }

        const created = await createJob({
            name: `index_${selectedVecstore.name}`,
            description: `Индексация файлов в векторное хранилище ${selectedVecstore.name}`,
            kind: "storage-vecstore-indexing",
            storageVecstoreIndexing: {
                vecstoreId: selectedVecstore.id,
                fileIds,
            },
        });

        if (!created) {
            return;
        }

        setIndexingJobId(created.job.id);
        setIsIndexingModalOpen(true);
    };

    const handleRemoveFromIndex = async (fileIds: string[]) => {
        if (!selectedVecstore) {
            return;
        }

        await storageStore.removeIndexedFilesFromVecstore(
            selectedVecstore.id,
            fileIds,
        );
    };

    return (
        <>
            <section className="flex h-full">
                <StorageVecstoresSidebar
                    isLoading={storageStore.isLoading}
                    isSubmitting={storageStore.isSubmitting}
                    vecstores={storageStore.linkedVecstores}
                    selectedVecstoreId={selectedVecstore?.id ?? null}
                    onCreateVecstore={handleOpenCreateModal}
                    onFullRefresh={() => {
                        void storageStore.refreshVecstores();
                    }}
                    onSelectVecstore={setSelectedVecstoreId}
                />
                <StorageVectstoresContent
                    selectedVecstore={selectedVecstore}
                    selectedFolder={selectedVecstoreFolder}
                    selectedNonVectorizedFiles={
                        selectedVecstoreNonVectorizedFiles
                    }
                    selectedVectorizedFiles={selectedVecstoreVectorizedFiles}
                    isSubmitting={storageStore.isSubmitting}
                    onOpenFolderPath={() => {
                        void handleOpenFolderPath();
                    }}
                    onRefreshVecstore={() => {
                        void handleRefreshVecstore();
                    }}
                    onOpenUpdateModal={handleOpenUpdateModal}
                    onDeleteVecstore={() => {
                        void handleDeleteVecstore();
                    }}
                    onAddToIndex={(fileIds) => {
                        void handleAddToIndex(fileIds);
                    }}
                    onRemoveFromIndex={(fileIds) => {
                        void handleRemoveFromIndex(fileIds);
                    }}
                />
            </section>

            <Modal
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                className="max-w-xl"
            >
                <Modal.Header className="text-main-100">
                    Создать векторное хранилище
                </Modal.Header>

                <Modal.Content>
                    <StorageVecstoreManagingForm
                        model={createVecstoreModel}
                        folders={storageStore.folders}
                        formId={createVecstoreFormId}
                        isSubmitting={storageStore.isSubmitting}
                        onSubmit={handleCreateVecstore as () => Promise<void>}
                    />
                </Modal.Content>

                <Modal.Footer>
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
                </Modal.Footer>
            </Modal>

            <Modal
                open={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                className="max-w-xl"
            >
                <Modal.Header className="text-main-100">
                    Изменить векторное хранилище
                </Modal.Header>

                <Modal.Content>
                    <StorageVecstoreManagingForm
                        model={updateVecstoreModel}
                        folders={storageStore.folders}
                        formId={updateVecstoreFormId}
                        isSubmitting={storageStore.isSubmitting}
                        onSubmit={handleUpdateVecstore as () => Promise<void>}
                    />
                </Modal.Content>

                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setIsUpdateModalOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            form={updateVecstoreFormId}
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            disabled={storageStore.isSubmitting}
                        >
                            Сохранить
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            <Modal
                open={isIndexingModalOpen}
                onClose={() => setIsIndexingModalOpen(false)}
                className="max-w-2xl"
            >
                <Modal.Header className="text-main-100">
                    Индексация файлов
                </Modal.Header>

                <Modal.Content>
                    <StorageIndexingProgressForm
                        open={isIndexingModalOpen}
                        job={indexingJob}
                        events={indexingEvents}
                    />
                </Modal.Content>

                <Modal.Footer>
                    <Button
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={() => setIsIndexingModalOpen(false)}
                    >
                        Закрыть
                    </Button>
                    <Button
                        variant="danger"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={!indexingJob?.isPending || !indexingJobId}
                        onClick={() => {
                            if (!indexingJobId) {
                                return;
                            }

                            void cancelJobById(indexingJobId);
                        }}
                    >
                        Остановить
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
});
