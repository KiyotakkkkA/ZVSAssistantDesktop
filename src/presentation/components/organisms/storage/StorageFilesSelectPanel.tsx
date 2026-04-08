import { Icon } from "@iconify/react";
import {
    Button,
    InputSmall,
    PrettyBR,
    Separator,
    TreeView,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";

type StorageFileMock = {
    id: string;
    name: string;
    extension: string;
    size: string;
    updatedAt: string;
    source: "GitHub" | "GitLab" | "Local";
};

type StorageFolderMock = {
    id: string;
    name: string;
    description: string;
    files: StorageFileMock[];
};

type CheckboxState = "checked" | "unchecked" | "partial";
type FolderSelectionState = {
    selectAll: boolean;
    explicit: Set<string>;
};

const generateOneThousandFiles = (): StorageFileMock[] => {
    const files: StorageFileMock[] = [];
    for (let i = 1; i <= 1000; i++) {
        files.push({
            id: `file-${i}`,
            name: globalThis.crypto?.randomUUID?.(),
            extension: "txt",
            size: `${Math.floor(Math.random() * 100)} KB`,
            updatedAt: `${Math.floor(Math.random() * 30) + 1}.04.2026, ${Math.floor(Math.random() * 24)}:${Math.floor(Math.random() * 60)}`,
            source: ["GitHub", "GitLab", "Local"][
                Math.floor(Math.random() * 3)
            ] as "GitHub" | "GitLab" | "Local",
        });
    }
    return files;
};

const foldersMocks = [
    {
        id: "folder-1",
        name: "Рабочие документы",
        description: "Технические спецификации и схемы",
        files: generateOneThousandFiles(),
    },
    {
        id: "folder-2",
        name: "Личные файлы",
        description: "Черновики и вспомогательные заметки",
        files: [
            {
                id: "file-201",
                name: "weekly-notes",
                extension: "txt",
                size: "45 KB",
                updatedAt: "05.04.2026, 18:31",
                source: "Local",
            },
            {
                id: "file-202",
                name: "ideas-backlog",
                extension: "md",
                size: "67 KB",
                updatedAt: "07.04.2026, 21:07",
                source: "GitHub",
            },
        ],
    },
    {
        id: "folder-3",
        name: "Контракты",
        description: "Юридические документы и соглашения",
        files: [
            {
                id: "file-301",
                name: "nda-template",
                extension: "docx",
                size: "128 KB",
                updatedAt: "02.04.2026, 11:03",
                source: "GitLab",
            },
            {
                id: "file-302",
                name: "service-agreement-v2",
                extension: "pdf",
                size: "1.1 MB",
                updatedAt: "08.04.2026, 16:19",
                source: "GitHub",
            },
        ],
    },
    {
        id: "folder-32",
        name: "Контракты",
        description: "Юридические документы и соглашения",
        files: [
            {
                id: "file-301",
                name: "nda-template",
                extension: "docx",
                size: "128 KB",
                updatedAt: "02.04.2026, 11:03",
                source: "GitLab",
            },
            {
                id: "file-302",
                name: "service-agreement-v2",
                extension: "pdf",
                size: "1.1 MB",
                updatedAt: "08.04.2026, 16:19",
                source: "GitHub",
            },
        ],
    },
    {
        id: "folder-5",
        name: "Контракты",
        description: "Юридические документы и соглашения",
        files: generateOneThousandFiles(),
    },
] satisfies StorageFolderMock[];

type SquareCheckboxProps = {
    state: CheckboxState;
    onClick: () => void;
    className?: string;
};

const SquareCheckbox = ({
    state,
    onClick,
    className = "",
}: SquareCheckboxProps) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={state === "partial" ? "mixed" : state === "checked"}
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition-colors ${
            state === "checked" || state === "partial"
                ? "border-indigo-400 bg-indigo-500/25 text-indigo-200"
                : "border-main-500 bg-main-900/70 text-main-300 hover:border-main-300"
        } ${className}`}
    >
        {state === "checked" && (
            <Icon icon="mdi:check" width={12} height={12} />
        )}
        {state === "partial" && (
            <Icon icon="mdi:minus" width={12} height={12} />
        )}
    </button>
);

export const StorageFilesSelectPanel = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFolderId, setSelectedFolderId] = useState(
        foldersMocks[0]?.id || "",
    );
    const [folderSelections, setFolderSelections] = useState<
        Record<string, FolderSelectionState>
    >({});

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredFolders = foldersMocks.filter((folder) => {
        if (!normalizedQuery) {
            return true;
        }

        const includesFolderMeta =
            folder.name.toLowerCase().includes(normalizedQuery) ||
            folder.id.toLowerCase().includes(normalizedQuery);

        if (includesFolderMeta) {
            return true;
        }

        return folder.files.some(
            (file) =>
                file.name.toLowerCase().includes(normalizedQuery) ||
                file.id.toLowerCase().includes(normalizedQuery) ||
                file.extension.toLowerCase().includes(normalizedQuery),
        );
    });

    const selectedFolder =
        filteredFolders.find((folder) => folder.id === selectedFolderId) ||
        filteredFolders[0] ||
        null;

    const getFolderSelection = (folderId: string): FolderSelectionState =>
        folderSelections[folderId] ?? {
            selectAll: false,
            explicit: new Set<string>(),
        };

    const isFileSelected = (folderId: string, fileId: string) => {
        const folderSelection = getFolderSelection(folderId);
        return folderSelection.selectAll
            ? !folderSelection.explicit.has(fileId)
            : folderSelection.explicit.has(fileId);
    };

    const getFolderSelectionStats = (folder: StorageFolderMock) => {
        const folderSelection = getFolderSelection(folder.id);
        const total = folder.files.length;
        const selected = folderSelection.selectAll
            ? Math.max(total - folderSelection.explicit.size, 0)
            : folderSelection.explicit.size;

        let state: CheckboxState = "unchecked";
        if (selected === total && total > 0) {
            state = "checked";
        } else if (selected > 0) {
            state = "partial";
        }

        return {
            state,
            selected,
            total,
        };
    };

    const toggleFileSelection = (folderId: string, fileId: string) => {
        setFolderSelections((prev) => {
            const current = prev[folderId] ?? {
                selectAll: false,
                explicit: new Set<string>(),
            };
            const nextExplicit = new Set(current.explicit);

            if (current.selectAll) {
                if (nextExplicit.has(fileId)) {
                    nextExplicit.delete(fileId);
                } else {
                    nextExplicit.add(fileId);
                }
            } else if (nextExplicit.has(fileId)) {
                nextExplicit.delete(fileId);
            } else {
                nextExplicit.add(fileId);
            }

            return {
                ...prev,
                [folderId]: {
                    selectAll: current.selectAll,
                    explicit: nextExplicit,
                },
            };
        });
    };

    const setFolderSelection = (
        folder: StorageFolderMock,
        shouldSelectAll: boolean,
    ) => {
        setFolderSelections((prev) => {
            return {
                ...prev,
                [folder.id]: {
                    selectAll: shouldSelectAll,
                    explicit: new Set<string>(),
                },
            };
        });
    };

    return (
        <section className="flex h-full min-h-0 flex-col md:flex-row">
            <aside className="w-full min-h-0 border-b border-main-600/55 p-4 md:flex md:w-1/3 md:flex-col md:border-b-0 md:border-r xl:w-1/4">
                <InputSmall
                    placeholder="Поиск файлов по имени или ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button
                    variant="primary"
                    className="mt-4 w-full p-1 gap-2"
                    shape="rounded-lg"
                >
                    <Icon
                        icon="mdi:plus-circle-outline"
                        width={22}
                        height={22}
                    />
                    Создать папку
                </Button>
                <div className="mt-1">
                    <PrettyBR icon="mdi:folder" label="Хранимые папки" />
                </div>

                <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto">
                    {filteredFolders.length > 0 ? (
                        <TreeView>
                            {filteredFolders.map((folder) => {
                                const folderStats =
                                    getFolderSelectionStats(folder);

                                return (
                                    <div key={folder.id}>
                                        <TreeView.Catalog
                                            title={`${folder.name} (${folder.files.length})`}
                                            defaultOpen={
                                                folder.id === selectedFolder?.id
                                            }
                                            virtualized={true}
                                            height={Math.min(
                                                folder.files.length * 40,
                                                300,
                                            )}
                                        >
                                            <TreeView.Element
                                                onClick={() => {
                                                    setSelectedFolderId(
                                                        folder.id,
                                                    );
                                                    setFolderSelection(
                                                        folder,
                                                        folderStats.state !==
                                                            "checked",
                                                    );
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-2 text-xs">
                                                    <div className="flex min-w-0 items-center gap-2 text-main-200">
                                                        <SquareCheckbox
                                                            state={
                                                                folderStats.state
                                                            }
                                                            onClick={() =>
                                                                setFolderSelection(
                                                                    folder,
                                                                    folderStats.state !==
                                                                        "checked",
                                                                )
                                                            }
                                                        />
                                                        <span className="truncate text-main-400">
                                                            Выбрать все
                                                        </span>
                                                    </div>
                                                    <span className="shrink-0 text-[10px] text-main-400">
                                                        {folderStats.selected}/
                                                        {folderStats.total}
                                                    </span>
                                                </div>
                                            </TreeView.Element>

                                            {folder.files.map((file) => (
                                                <TreeView.Element
                                                    key={`${folder.id}::${file.id}`}
                                                    onClick={() => {
                                                        setSelectedFolderId(
                                                            folder.id,
                                                        );
                                                        toggleFileSelection(
                                                            folder.id,
                                                            file.id,
                                                        );
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <SquareCheckbox
                                                            state={
                                                                isFileSelected(
                                                                    folder.id,
                                                                    file.id,
                                                                )
                                                                    ? "checked"
                                                                    : "unchecked"
                                                            }
                                                            onClick={() => {
                                                                setSelectedFolderId(
                                                                    folder.id,
                                                                );
                                                                toggleFileSelection(
                                                                    folder.id,
                                                                    file.id,
                                                                );
                                                            }}
                                                        />
                                                        <span className="truncate">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                </TreeView.Element>
                                            ))}
                                        </TreeView.Catalog>
                                        <Separator className="my-2" />
                                    </div>
                                );
                            })}
                        </TreeView>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3">
                            <Icon
                                icon="mdi:file-search-outline"
                                width={48}
                                height={48}
                                className="text-main-500"
                            />
                            <p className="text-sm text-main-300">
                                По вашему запросу ничего не найдено
                            </p>
                        </div>
                    )}
                </div>
            </aside>

            <div className="w-full min-h-0 flex-1 p-4 md:flex md:flex-col">
                <div className="text-sm text-main-300">Контент</div>
            </div>
        </section>
    );
};
