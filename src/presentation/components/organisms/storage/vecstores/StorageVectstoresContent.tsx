import { Icon } from "@iconify/react";
import { Button, Separator } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { StorageFolderEntity } from "../../../../../../electron/models/storage";
import type { StorageVecstoreEntity } from "../../../../../../electron/models/storage";
import { convertBytesToSize } from "../../../../../utils/converters";

type StorageVectstoresContentProps = {
    selectedVecstore: StorageVecstoreEntity | null;
    selectedFolder: StorageFolderEntity | null;
    isSubmitting: boolean;
    onOpenFolderPath: () => void;
    onOpenRenameModal: () => void;
    onOpenDeleteModal: () => void;
};

export const StorageVectstoresContent = ({
    selectedVecstore,
    selectedFolder,
    isSubmitting,
    onOpenFolderPath,
    onOpenRenameModal,
    onOpenDeleteModal,
}: StorageVectstoresContentProps) => {
    if (!selectedVecstore) {
        return (
            <div className="flex-1 p-4 animate-card-rise-in">
                <div className="flex-1 flex-col items-center justify-center gap-4 text-sm text-main-300">
                    <Icon icon="mdi:database-off" width={48} height={48} />
                    <p>Пока что здесь ничего нет...</p>
                </div>
            </div>
        );
    }

    const formatDate = (value: string) => new Date(value).toLocaleString();

    return (
        <div className="flex-1 p-4 animate-card-rise-in">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-main-100">
                    <Icon icon="mdi:database" width={18} height={18} />
                    <h3 className="text-lg font-semibold">
                        {selectedVecstore.name}
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        label="Открыть папку"
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={!selectedVecstore}
                        onClick={onOpenFolderPath}
                    >
                        <Icon icon="mdi:folder-open-outline" />
                    </Button>
                    <Button
                        label="Переименовать"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={isSubmitting}
                        onClick={onOpenRenameModal}
                    >
                        <Icon icon="mdi:pencil-outline" />
                    </Button>
                    <Separator
                        orientation="vertical"
                        className="h-5 bg-main-400"
                    />
                    <Button
                        label="Удалить"
                        variant="danger"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={isSubmitting}
                        onClick={onOpenDeleteModal}
                    >
                        <Icon icon="mdi:delete-outline" />
                    </Button>
                </div>
            </div>

            <table className="w-full border-collapse text-left">
                <tbody>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">ID</td>
                        <td className="py-2 text-sm text-main-100">
                            {selectedVecstore.id}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">
                            Папка
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {selectedFolder ? selectedFolder.name : "—"}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">
                            Путь
                        </td>
                        <td className="py-2 text-sm text-main-100 break-all">
                            {selectedVecstore.path}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">
                            Размер
                        </td>
                        <td className="text-sm text-main-100">
                            {convertBytesToSize(selectedVecstore.size, {
                                inputUnit: "MB",
                            })}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">
                            Сущностей
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {selectedVecstore.entities_count}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-52 py-2 text-sm text-main-300">
                            Последнее изменение
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {formatDate(selectedVecstore.updated_at)}
                        </td>
                    </tr>
                    <tr>
                        <td className="w-52 py-2 text-sm text-main-300">
                            Дата создания
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {formatDate(selectedVecstore.created_at)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
