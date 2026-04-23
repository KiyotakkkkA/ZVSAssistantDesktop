import { Icon } from "@iconify/react";
import { Button, Separator, TreeView } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type {
    StorageFileEntity,
    StorageFolderEntity,
} from "../../../../../../electron/models/storage";
import { convertBytesToSize } from "../../../../../utils/converters";
import { StorageFolderIdFormat } from "../../../../../utils/creators";
import { ButtonCreate, ButtonDelete } from "../../../atoms";

type StorageFilesContentProps = {
    selectedFolder: StorageFolderEntity | null;
    selectedFolderFiles: StorageFileEntity[];
    filteredFiles: StorageFileEntity[];
    isSubmitting: boolean;
    onAddFiles: () => void;
    onOpenFolderPath: () => void;
    onDeleteFolder: () => void;
    onRefreshFolder: () => void;
    onCreateVecstoreOnFolder: (folderId: StorageFolderIdFormat) => void;
    onOpenRenameModal: () => void;
};

export const StorageFilesContent = ({
    selectedFolder,
    selectedFolderFiles,
    filteredFiles,
    isSubmitting,
    onAddFiles,
    onOpenFolderPath,
    onCreateVecstoreOnFolder,
    onRefreshFolder,
    onOpenRenameModal,
    onDeleteFolder,
}: StorageFilesContentProps) => {
    return (
        <div className="flex-1 p-4 animate-card-rise-in">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-base text-main-100">Контент</h3>
                    <p className="text-xs text-main-400">
                        {selectedFolder
                            ? `${selectedFolder.name} • ${convertBytesToSize(selectedFolder.size, { inputUnit: "MB" })}`
                            : "Выберите папку слева"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {!selectedFolder?.vecstore_id && (
                        <>
                            <ButtonCreate
                                label="Создать хранилище"
                                className="p-1 gap-2"
                                createFn={() =>
                                    onCreateVecstoreOnFolder(selectedFolder!.id)
                                }
                            ></ButtonCreate>
                            <Separator
                                orientation="vertical"
                                className="h-5 bg-main-400"
                            />
                        </>
                    )}
                    <Button
                        label="Добавить файл"
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={!selectedFolder || isSubmitting}
                        onClick={onAddFiles}
                    >
                        <Icon icon="mdi:file-plus-outline" />
                    </Button>
                    <Button
                        label="Открыть директорию"
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={!selectedFolder}
                        onClick={onOpenFolderPath}
                    >
                        <Icon icon="mdi:folder-open-outline" />
                    </Button>
                    <Separator
                        orientation="vertical"
                        className="h-5 bg-main-400"
                    />
                    <Button
                        label="Обновить содержимое"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={!selectedFolder || isSubmitting}
                        onClick={onRefreshFolder}
                    >
                        <Icon icon="mdi:refresh" />
                    </Button>
                    <Button
                        label="Переименовать"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={!selectedFolder}
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
                        className="h-9 w-9 p-0"
                        confirm
                        labelModal={`Вы уверены, что хотите удалить папку '${selectedFolder?.name}' и все её содержимое?`}
                        disabled={!selectedFolder}
                        deleteFn={onDeleteFolder}
                    />
                </div>
            </div>

            <div className="rounded-2xl">
                {selectedFolder && filteredFiles.length > 0 ? (
                    <TreeView>
                        <TreeView.Catalog
                            title={`Данные (${filteredFiles.length})`}
                            virtualized
                            defaultOpen
                        >
                            {filteredFiles.map((file) => (
                                <TreeView.Element key={file.id}>
                                    <div className="flex items-center justify-between gap-2 text-xs text-main-200">
                                        <span className="truncate">
                                            <Icon
                                                icon="mdi:file-document-outline"
                                                width={14}
                                                height={14}
                                                className="mr-1 inline-flex"
                                            />
                                            {file.name}
                                        </span>
                                        <span className="shrink-0 text-main-400">
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
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:folder-search-outline"
                            width={64}
                            height={64}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            {!selectedFolder
                                ? "Папка не выбрана"
                                : selectedFolderFiles.length === 0
                                  ? "Папка пуста"
                                  : "Файлы не найдены"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
