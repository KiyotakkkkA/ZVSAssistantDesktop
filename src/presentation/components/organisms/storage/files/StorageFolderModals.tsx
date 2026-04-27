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
        <Modal open={open} onClose={onClose} className="max-w-md">
            <Modal.Header>Создать папку</Modal.Header>

            <Modal.Content>
                <div className="space-y-3">
                    <InputSmall
                        placeholder="Название папки"
                        value={folderName}
                        onChange={(event) =>
                            onFolderNameChange(event.target.value)
                        }
                    />
                </div>
            </Modal.Content>

            <Modal.Footer>
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
            </Modal.Footer>
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
        <Modal open={open} onClose={onClose} className="max-w-md">
            <Modal.Header>Переименовать папку</Modal.Header>

            <Modal.Content>
                <InputSmall
                    placeholder="Новое название"
                    value={folderName}
                    onChange={(event) => onFolderNameChange(event.target.value)}
                />
            </Modal.Content>

            <Modal.Footer>
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
            </Modal.Footer>
        </Modal>
    );
};
