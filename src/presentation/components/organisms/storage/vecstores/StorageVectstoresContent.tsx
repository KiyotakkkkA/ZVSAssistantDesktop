import { Icon } from "@iconify/react";
import {
    Button,
    InputSmall,
    Separator,
    TreeView,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import type { StorageFileEntity } from "../../../../../../electron/models/storage";
import type { StorageFolderEntity } from "../../../../../../electron/models/storage";
import type { StorageVecstoreEntity } from "../../../../../../electron/models/storage";
import { convertBytesToSize } from "../../../../../utils/converters";

type StorageVectstoresContentProps = {
    selectedVecstore: StorageVecstoreEntity | null;
    selectedFolder: StorageFolderEntity | null;
    selectedFolderFiles: StorageFileEntity[];
    isSubmitting: boolean;
    onOpenFolderPath: () => void;
    onRefreshVecstore: () => void;
    onOpenRenameModal: () => void;
    onOpenDeleteModal: () => void;
};

type SquareCheckboxProps = {
    checked: boolean;
    disabled?: boolean;
};

const SquareCheckbox = ({ checked, disabled = false }: SquareCheckboxProps) => {
    return (
        <label
            className={`inline-flex items-center ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
        >
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                className="sr-only"
            />
            <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
                    checked
                        ? "border-main-200 bg-main-200 text-main-900"
                        : "border-main-500 bg-main-900 text-transparent"
                }`}
            >
                <Icon icon="mdi:check" width={12} height={12} />
            </span>
        </label>
    );
};

export const StorageVectstoresContent = ({
    selectedVecstore,
    selectedFolder,
    selectedFolderFiles,
    isSubmitting,
    onOpenFolderPath,
    onRefreshVecstore,
    onOpenRenameModal,
    onOpenDeleteModal,
}: StorageVectstoresContentProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFileIds, setSelectedFileIds] = useState<
        StorageFileEntity["id"][]
    >([]);

    useEffect(() => {
        setSearchQuery("");
        setSelectedFileIds([]);
    }, [selectedVecstore?.id]);

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredFiles = useMemo(() => {
        if (!normalizedQuery) {
            return selectedFolderFiles;
        }

        return selectedFolderFiles.filter((file) =>
            file.name.toLowerCase().includes(normalizedQuery),
        );
    }, [normalizedQuery, selectedFolderFiles]);

    const checkedFileIds = useMemo(() => {
        const ids = new Set(selectedFolderFiles.map((file) => file.id));
        return selectedFileIds.filter((id) => ids.has(id));
    }, [selectedFileIds, selectedFolderFiles]);

    const allVisibleSelected =
        filteredFiles.length > 0 &&
        filteredFiles.every((file) => checkedFileIds.includes(file.id));

    const toggleFile = (fileId: StorageFileEntity["id"], checked: boolean) => {
        setSelectedFileIds((prev) => {
            if (checked) {
                if (prev.includes(fileId)) {
                    return prev;
                }

                return [...prev, fileId];
            }

            return prev.filter((id) => id !== fileId);
        });
    };

    const toggleAllVisible = (checked: boolean) => {
        if (checked) {
            setSelectedFileIds((prev) => {
                const next = new Set(prev);
                for (const file of filteredFiles) {
                    next.add(file.id);
                }

                return Array.from(next);
            });
            return;
        }

        const visibleIds = new Set(filteredFiles.map((file) => file.id));
        setSelectedFileIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    };

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
                    <Separator
                        orientation="vertical"
                        className="h-5 bg-main-400"
                    />
                    <Button
                        label="Рефреш по ID"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={isSubmitting}
                        onClick={onRefreshVecstore}
                    >
                        <Icon icon="mdi:refresh" />
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
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon icon="mdi:info" width={18} height={18} />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">ID</td>
                        <td className="py-2 text-sm text-main-100">
                            {selectedVecstore.id}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon icon="mdi:folder" width={18} height={18} />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">
                            На основе папки
                        </td>
                        <td className="py-2 text-sm text-main-100 break-all">
                            {selectedFolder?.name || "Папка не найдена"}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon icon="mdi:weight" width={18} height={18} />
                        </td>
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
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon icon="mdi:files" width={18} height={18} />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">
                            Сущностей
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {selectedVecstore.entities_count}
                        </td>
                    </tr>
                    <tr className="border-b border-main-700/50">
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon
                                icon="mdi:clock-outline"
                                width={18}
                                height={18}
                            />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">
                            Последнее изменение
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {formatDate(selectedVecstore.updated_at)}
                        </td>
                    </tr>
                    <tr>
                        <td className="w-20 py-2 text-sm text-main-300">
                            <Icon icon="mdi:clock" width={18} height={18} />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">
                            Дата создания
                        </td>
                        <td className="py-2 text-sm text-main-100">
                            {formatDate(selectedVecstore.created_at)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <Separator
                orientation="horizontal"
                className="my-6 bg-main-700/70"
            />

            <section className="flex items-start gap-4">
                <div className="w-full max-w-180">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold text-main-100">
                            Неиндексированные документы
                        </h4>
                        <Button
                            variant="secondary"
                            shape="rounded-md"
                            className="h-8 gap-2 px-3 text-xs"
                            disabled={checkedFileIds.length === 0}
                        >
                            <Icon icon="mdi:database-export" />
                            Добавить в индекс
                        </Button>
                    </div>

                    <div className="mb-3 flex items-center gap-3">
                        <InputSmall
                            value={searchQuery}
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder="Поиск документа"
                        />
                        <div
                            className="flex items-center gap-2 text-xs text-main-300"
                            onClick={() =>
                                toggleAllVisible(!allVisibleSelected)
                            }
                        >
                            <SquareCheckbox checked={allVisibleSelected} />
                            Выбрать все
                        </div>
                    </div>

                    {filteredFiles.length > 0 ? (
                        <TreeView>
                            <TreeView.Catalog
                                title={`${filteredFiles.length} файлов`}
                                virtualized
                                defaultOpen
                            >
                                {filteredFiles.map((file) => (
                                    <TreeView.Element
                                        key={file.id}
                                        onClick={() =>
                                            toggleFile(
                                                file.id,
                                                !checkedFileIds.includes(
                                                    file.id,
                                                ),
                                            )
                                        }
                                    >
                                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 py-0.5 text-xs text-main-200">
                                            <SquareCheckbox
                                                checked={checkedFileIds.includes(
                                                    file.id,
                                                )}
                                            />
                                            <span className="truncate">
                                                <Icon
                                                    icon="mdi:file-document-outline"
                                                    width={14}
                                                    height={14}
                                                    className="mr-1 inline-flex"
                                                />
                                                {file.name}
                                            </span>
                                            <span className="text-main-400">
                                                {convertBytesToSize(file.size, {
                                                    inputUnit: "MB",
                                                })}
                                            </span>
                                        </div>
                                    </TreeView.Element>
                                ))}
                            </TreeView.Catalog>
                        </TreeView>
                    ) : (
                        <div className="flex h-32 items-center justify-center text-sm text-main-400">
                            Документы не найдены
                        </div>
                    )}

                    <p className="mt-3 text-xs text-main-300">
                        Выбрано файлов: {checkedFileIds.length}
                    </p>
                </div>

                <div className="flex-1" />
            </section>
        </div>
    );
};
