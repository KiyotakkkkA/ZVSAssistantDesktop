import { Button, InputSmall, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";

type StorageRenameVecstoreModalProps = {
    open: boolean;
    isSubmitting: boolean;
    vecstoreName: string;
    vecstoreDescription: string;
    onClose: () => void;
    onVecstoreNameChange: (name: string) => void;
    onVecstoreDescriptionChange: (description: string) => void;
    onConfirm: () => void;
};

export const StorageRenameVecstoreModal = ({
    open,
    isSubmitting,
    vecstoreName,
    vecstoreDescription,
    onClose,
    onVecstoreNameChange,
    onVecstoreDescriptionChange,
    onConfirm,
}: StorageRenameVecstoreModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Переименовать векторное хранилище"
            className="max-w-md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={onClose}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                    >
                        Сохранить
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <InputSmall
                    placeholder="Новое название"
                    value={vecstoreName}
                    onChange={(event) =>
                        onVecstoreNameChange(event.target.value)
                    }
                />

                <InputSmall
                    placeholder="Описание"
                    value={vecstoreDescription}
                    onChange={(event) =>
                        onVecstoreDescriptionChange(event.target.value)
                    }
                />
            </div>
        </Modal>
    );
};

type StorageDeleteVecstoreModalProps = {
    open: boolean;
    isSubmitting: boolean;
    vecstoreName: string;
    onClose: () => void;
    onConfirm: () => void;
};

export const StorageDeleteVecstoreModal = ({
    open,
    isSubmitting,
    vecstoreName,
    onClose,
    onConfirm,
}: StorageDeleteVecstoreModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Удаление векторного хранилища"
            className="max-w-md"
            footer={
                <>
                    <Button
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={onClose}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="danger"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                    >
                        Удалить
                    </Button>
                </>
            }
        >
            <p className="text-sm text-main-300">
                Удалить векторное хранилище {vecstoreName}?
            </p>
        </Modal>
    );
};
