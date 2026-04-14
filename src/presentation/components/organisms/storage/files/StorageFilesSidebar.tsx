import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type {
    StorageFileEntity,
    StorageFolderEntity,
} from "../../../../../../electron/models/storage";

type StorageFilesSidebarProps = {
    isLoading: boolean;
    searchQuery: string;
    hasSelectedFolder: boolean;
    folders: StorageFolderEntity[];
    files: StorageFileEntity[];
    selectedFolderId: string | null;
    onSearchQueryChange: (value: string) => void;
    onCreateFolder: () => void;
    onSelectFolder: (folderId: string) => void;
};

export const StorageFilesSidebar = ({
    isLoading,
    searchQuery,
    hasSelectedFolder,
    folders,
    files,
    selectedFolderId,
    onSearchQueryChange,
    onCreateFolder,
    onSelectFolder,
}: StorageFilesSidebarProps) => {
    return (
        <aside className="min-h-0 border-b border-main-600/55 w-1/5 border-r p-4">
            <InputSmall
                placeholder="Поиск файлов по имени или пути..."
                value={searchQuery}
                disabled={!hasSelectedFolder}
                onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            <Button
                variant="primary"
                className="mt-4 w-full p-1 gap-2"
                shape="rounded-lg"
                onClick={onCreateFolder}
            >
                <Icon icon="mdi:plus-circle-outline" width={22} height={22} />
                Создать папку
            </Button>
            <div className="mt-1">
                <PrettyBR icon="mdi:folder" label="Хранимые папки" />
            </div>

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-main-300">
                        Загрузка папок...
                    </div>
                ) : folders.length > 0 ? (
                    <div className="space-y-2">
                        {folders.map((folder) => {
                            const filesCount = files.filter(
                                (file) => file.folder_id === folder.id,
                            ).length;

                            return (
                                <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectFolder(folder.id);
                                    }}
                                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                                        folder.id === selectedFolderId
                                            ? "border-main-300/60 bg-main-700/70"
                                            : "border-main-700/70 bg-main-900/45 hover:border-main-500/70"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm text-main-100">
                                                {folder.name}
                                            </p>
                                            <p className="truncate text-[11px] text-main-400">
                                                {folder.path}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[11px] text-main-300">
                                            {filesCount}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:file-search-outline"
                            width={48}
                            height={48}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">Папок пока нет</p>
                    </div>
                )}
            </div>
        </aside>
    );
};
