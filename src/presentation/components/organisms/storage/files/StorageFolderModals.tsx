import { Button, InputSmall, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";

type StorageCreateFolderModalProps = {
    open: boolean;
    isSubmitting: boolean;
    folderName: string;
    onClose: () => void;
    onFolderNameChange: (name: string) => void;
    onConfirm: () => void;
};

export const StorageCreateFolderModal = ({
    open,
    isSubmitting,
    folderName,
    onClose,
    onFolderNameChange,
    onConfirm,
}: StorageCreateFolderModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Создать папку"
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
                        Создать
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <InputSmall
                    placeholder="Название папки"
                    value={folderName}
                    onChange={(event) => onFolderNameChange(event.target.value)}
                />
            </div>
        </Modal>
    );
};

type StorageRenameFolderModalProps = {
    open: boolean;
    isSubmitting: boolean;
    folderName: string;
    onClose: () => void;
    onFolderNameChange: (name: string) => void;
    onConfirm: () => void;
};

export const StorageRenameFolderModal = ({
    open,
    isSubmitting,
    folderName,
    onClose,
    onFolderNameChange,
    onConfirm,
}: StorageRenameFolderModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Переименовать папку"
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
            <InputSmall
                placeholder="Новое название"
                value={folderName}
                onChange={(event) => onFolderNameChange(event.target.value)}
            />
        </Modal>
    );
};

type StorageDeleteFolderModalProps = {
    open: boolean;
    isSubmitting: boolean;
    folderName: string;
    onClose: () => void;
    onConfirm: () => void;
};

export const StorageDeleteFolderModal = ({
    open,
    isSubmitting,
    folderName,
    onClose,
    onConfirm,
}: StorageDeleteFolderModalProps) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Удаление папки"
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
            <p className="text-sm text-main-300">Удалить папку {folderName}?</p>
        </Modal>
    );
};
