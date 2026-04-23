import { Icon } from "@iconify/react";
import {
    Button,
    InputSmall,
    Separator,
    TreeView,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import {
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import type { StorageFileEntity } from "../../../../../../electron/models/storage";
import type { StorageFolderEntity } from "../../../../../../electron/models/storage";
import type { StorageVecstoreEntity } from "../../../../../../electron/models/storage";
import { convertBytesToSize } from "../../../../../utils/converters";
import { ButtonDelete } from "../../../atoms";

type StorageVectstoresContentProps = {
    selectedVecstore: StorageVecstoreEntity | null;
    selectedFolder: StorageFolderEntity | null;
    selectedNonVectorizedFiles: StorageFileEntity[];
    selectedVectorizedFiles: StorageFileEntity[];
    isSubmitting: boolean;
    onOpenFolderPath: () => void;
    onRefreshVecstore: () => void;
    onOpenRenameModal: () => void;
    onDeleteVecstore: () => void;
    onAddToIndex: (fileIds: StorageFileEntity["id"][]) => void;
    onRemoveFromIndex: (fileIds: StorageFileEntity["id"][]) => void;
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
                readOnly
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
    selectedNonVectorizedFiles,
    selectedVectorizedFiles,
    isSubmitting,
    onOpenFolderPath,
    onRefreshVecstore,
    onOpenRenameModal,
    onDeleteVecstore,
    onAddToIndex,
    onRemoveFromIndex,
}: StorageVectstoresContentProps) => {
    const [nonIndexedSearchQuery, setNonIndexedSearchQuery] = useState("");
    const [indexedSearchQuery, setIndexedSearchQuery] = useState("");
    const [selectedNonIndexedFileIds, setSelectedNonIndexedFileIds] = useState<
        StorageFileEntity["id"][]
    >([]);
    const [selectedIndexedFileIds, setSelectedIndexedFileIds] = useState<
        StorageFileEntity["id"][]
    >([]);

    useEffect(() => {
        setNonIndexedSearchQuery("");
        setIndexedSearchQuery("");
        setSelectedNonIndexedFileIds([]);
        setSelectedIndexedFileIds([]);
    }, [selectedVecstore?.id]);

    const normalizedNonIndexedQuery = nonIndexedSearchQuery
        .trim()
        .toLowerCase();
    const normalizedIndexedQuery = indexedSearchQuery.trim().toLowerCase();

    const filteredNonIndexedFiles = useMemo(() => {
        if (!normalizedNonIndexedQuery) {
            return selectedNonVectorizedFiles;
        }

        return selectedNonVectorizedFiles.filter((file) =>
            file.name.toLowerCase().includes(normalizedNonIndexedQuery),
        );
    }, [normalizedNonIndexedQuery, selectedNonVectorizedFiles]);

    const filteredIndexedFiles = useMemo(() => {
        if (!normalizedIndexedQuery) {
            return selectedVectorizedFiles;
        }

        return selectedVectorizedFiles.filter((file) =>
            file.name.toLowerCase().includes(normalizedIndexedQuery),
        );
    }, [normalizedIndexedQuery, selectedVectorizedFiles]);

    const checkedNonIndexedFileIds = useMemo(() => {
        const ids = new Set(selectedNonVectorizedFiles.map((file) => file.id));
        return selectedNonIndexedFileIds.filter((id) => ids.has(id));
    }, [selectedNonIndexedFileIds, selectedNonVectorizedFiles]);

    const checkedIndexedFileIds = useMemo(() => {
        const ids = new Set(selectedVectorizedFiles.map((file) => file.id));
        return selectedIndexedFileIds.filter((id) => ids.has(id));
    }, [selectedIndexedFileIds, selectedVectorizedFiles]);

    const allVisibleNonIndexedSelected =
        filteredNonIndexedFiles.length > 0 &&
        filteredNonIndexedFiles.every((file) =>
            checkedNonIndexedFileIds.includes(file.id),
        );

    const allVisibleIndexedSelected =
        filteredIndexedFiles.length > 0 &&
        filteredIndexedFiles.every((file) =>
            checkedIndexedFileIds.includes(file.id),
        );

    const toggleFile = (
        fileId: StorageFileEntity["id"],
        checked: boolean,
        setter: Dispatch<SetStateAction<StorageFileEntity["id"][]>>,
    ) => {
        setter((prev) => {
            if (checked) {
                if (prev.includes(fileId)) {
                    return prev;
                }

                return [...prev, fileId];
            }

            return prev.filter((id) => id !== fileId);
        });
    };

    const toggleAllVisible = (
        checked: boolean,
        files: StorageFileEntity[],
        setter: Dispatch<SetStateAction<StorageFileEntity["id"][]>>,
    ) => {
        if (checked) {
            setter((prev) => {
                const next = new Set(prev);
                for (const file of files) {
                    next.add(file.id);
                }

                return Array.from(next);
            });
            return;
        }

        const visibleIds = new Set(files.map((file) => file.id));
        setter((prev) => prev.filter((id) => !visibleIds.has(id)));
    };

    if (!selectedVecstore) {
        return (
            <div className="flex-1 p-4 animate-card-rise-in">
                <div className="flex flex-col items-center justify-center gap-3">
                    <Icon
                        icon="mdi:database-off"
                        width={48}
                        height={48}
                        className="text-main-500"
                    />
                    <p className="text-sm text-main-300">
                        Хранилище не выбрано
                    </p>
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
                    <ButtonDelete
                        size={22}
                        disabled={isSubmitting}
                        confirm
                        labelModal={`Вы уверены, что хотите удалить векторное хранилище '${selectedVecstore.name}'?`}
                        deleteFn={onDeleteVecstore}
                    ></ButtonDelete>
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
                            <Icon
                                icon="mdi:text-box-outline"
                                width={18}
                                height={18}
                            />
                        </td>
                        <td className="w-52 py-2 text-sm text-main-300">
                            Описание
                        </td>
                        <td className="py-2 text-sm text-main-100 break-all">
                            {selectedVecstore.description || "Без описания"}
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

            <section className="w-full">
                <div className="flex w-full justify-between">
                    <div className="flex-1">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-base font-semibold text-main-100">
                                Неиндексированные документы
                            </h4>
                            <Button
                                variant="secondary"
                                shape="rounded-md"
                                className="h-8 gap-2 px-3 text-xs"
                                disabled={
                                    selectedNonVectorizedFiles.length === 0 ||
                                    isSubmitting
                                }
                                onClick={() =>
                                    onAddToIndex(checkedNonIndexedFileIds)
                                }
                            >
                                <Icon icon="mdi:database-export" />
                                Добавить в индекс
                            </Button>
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                            <InputSmall
                                value={nonIndexedSearchQuery}
                                onChange={(event) =>
                                    setNonIndexedSearchQuery(event.target.value)
                                }
                                placeholder="Поиск документа"
                            />
                            <div
                                className="flex items-center gap-2 text-xs text-main-300"
                                onClick={() =>
                                    toggleAllVisible(
                                        !allVisibleNonIndexedSelected,
                                        filteredNonIndexedFiles,
                                        setSelectedNonIndexedFileIds,
                                    )
                                }
                            >
                                <SquareCheckbox
                                    checked={allVisibleNonIndexedSelected}
                                />
                                Выбрать все
                            </div>
                        </div>

                        {filteredNonIndexedFiles.length > 0 ? (
                            <TreeView>
                                <TreeView.Catalog
                                    title={`${filteredNonIndexedFiles.length} файлов`}
                                    virtualized
                                    defaultOpen
                                >
                                    {filteredNonIndexedFiles.map((file) => (
                                        <TreeView.Element
                                            key={file.id}
                                            onClick={() =>
                                                toggleFile(
                                                    file.id,
                                                    !checkedNonIndexedFileIds.includes(
                                                        file.id,
                                                    ),
                                                    setSelectedNonIndexedFileIds,
                                                )
                                            }
                                        >
                                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 py-0.5 text-xs text-main-200">
                                                <SquareCheckbox
                                                    checked={checkedNonIndexedFileIds.includes(
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
                                                    {convertBytesToSize(
                                                        file.size,
                                                        {
                                                            inputUnit: "MB",
                                                        },
                                                    )}
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
                            Выбрано файлов: {checkedNonIndexedFileIds.length}
                        </p>
                    </div>

                    <div className="flex-1">
                        <div className="relative flex h-full items-center justify-center">
                            <Icon
                                icon="mdi:swap-horizontal"
                                width={50}
                                height={50}
                            />
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-base font-semibold text-main-100">
                                Индексированные документы
                            </h4>
                            <ButtonDelete
                                label="Убрать из индекса"
                                size={18}
                                className="h-8 px-3 text-xs"
                                disabled={
                                    selectedVectorizedFiles.length === 0 ||
                                    isSubmitting
                                }
                                deleteFn={() =>
                                    onRemoveFromIndex(checkedIndexedFileIds)
                                }
                            />
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                            <InputSmall
                                value={indexedSearchQuery}
                                onChange={(event) =>
                                    setIndexedSearchQuery(event.target.value)
                                }
                                placeholder="Поиск документа"
                            />
                            <div
                                className="flex items-center gap-2 text-xs text-main-300"
                                onClick={() =>
                                    toggleAllVisible(
                                        !allVisibleIndexedSelected,
                                        filteredIndexedFiles,
                                        setSelectedIndexedFileIds,
                                    )
                                }
                            >
                                <SquareCheckbox
                                    checked={allVisibleIndexedSelected}
                                />
                                Выбрать все
                            </div>
                        </div>

                        {filteredIndexedFiles.length > 0 ? (
                            <TreeView>
                                <TreeView.Catalog
                                    title={`${filteredIndexedFiles.length} файлов`}
                                    virtualized
                                    defaultOpen
                                >
                                    {filteredIndexedFiles.map((file) => (
                                        <TreeView.Element
                                            key={file.id}
                                            onClick={() =>
                                                toggleFile(
                                                    file.id,
                                                    !checkedIndexedFileIds.includes(
                                                        file.id,
                                                    ),
                                                    setSelectedIndexedFileIds,
                                                )
                                            }
                                        >
                                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-1 py-0.5 text-xs text-main-200">
                                                <SquareCheckbox
                                                    checked={checkedIndexedFileIds.includes(
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
                                                    {convertBytesToSize(
                                                        file.size,
                                                        {
                                                            inputUnit: "MB",
                                                        },
                                                    )}
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
                            Выбрано файлов: {checkedIndexedFileIds.length}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};
