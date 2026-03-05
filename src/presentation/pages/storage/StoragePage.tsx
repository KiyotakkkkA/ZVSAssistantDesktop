import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { Icon } from "@iconify/react";
import { useJobs, useToasts, useVectorStorage } from "../../../hooks";
import { useFileSave, useFileUpload } from "../../../hooks/files";
import {
    AutoFillSelector,
    Button,
    InputCheckbox,
    InputSmall,
    Modal,
    Switcher,
    PrettyBR,
} from "../../components/atoms";
import { StoredFileCard } from "../../components/molecules/cards/storage";
import { LoadingFallbackPage } from "../LoadingFallbackPage";
import { storageStore } from "../../../stores/storageStore";
import type { UploadedFileData } from "../../../types/ElectronApi";

type StorageView = "files" | "vector-stores";

type PreparedVectorFile = {
    localId: string;
    source: "storage" | "upload";
    name: string;
    size: number;
    storageFileId?: string;
    uploadedFile?: UploadedFileData;
};

const STORAGE_VIEW_OPTIONS: { value: StorageView; label: string }[] = [
    { value: "files", label: "Файлы" },
    { value: "vector-stores", label: "Векторное хранилище" },
];

export const StoragePage = observer(function StoragePage() {
    const toasts = useToasts();
    const { createJob } = useJobs();
    const { createVectorStorage, createVectorTag, deleteVectorStorage } =
        useVectorStorage();
    const { pickFiles, pickPath, isUploading, isPickingPath } = useFileUpload();
    const { openFile, deleteFile, openPath } = useFileSave();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState<StorageView>("files");
    const [fileSearchQuery, setFileSearchQuery] = useState("");
    const [vectorSearchQuery, setVectorSearchQuery] = useState("");
    const [vectorTagFilters, setVectorTagFilters] = useState<string[]>([]);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isStorageFilesPickOpen, setIsStorageFilesPickOpen] = useState(false);
    const [storageFilesSearchQuery, setStorageFilesSearchQuery] = useState("");
    const [pickedStorageFileIds, setPickedStorageFileIds] = useState<string[]>(
        [],
    );
    const [preparedVectorFiles, setPreparedVectorFiles] = useState<
        PreparedVectorFile[]
    >([]);
    const [editableVectorStorageName, setEditableVectorStorageName] =
        useState("");
    const [isVectorStorageNameSaving, setIsVectorStorageNameSaving] =
        useState(false);
    const [newVectorTagName, setNewVectorTagName] = useState("");
    const [isVectorTagSaving, setIsVectorTagSaving] = useState(false);
    const files = storageStore.files;
    const vectorStorages = storageStore.vectorStorages;
    const selectedVectorStorage = storageStore.selectedVectorStorage;

    useEffect(() => {
        void storageStore.loadFilesData();
        void storageStore.loadVectorStoragesData();
        void storageStore.loadVectorTagsData();
    }, []);

    useEffect(() => {
        setEditableVectorStorageName(selectedVectorStorage?.name ?? "");
    }, [selectedVectorStorage?.id, selectedVectorStorage?.name]);

    const formatFileSize = (bytes: number) => {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return "0 КБ";
        }

        const units = ["Б", "КБ", "МБ", "ГБ"];
        const exponent = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1,
        );
        const value = bytes / 1024 ** exponent;

        return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    };

    const formatDateTime = (value: string) => {
        if (!value) {
            return "Неизвестно";
        }

        const parsedDate = new Date(value);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Неизвестно";
        }

        return parsedDate.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const filteredFiles = useMemo(() => {
        const normalizedQuery = fileSearchQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return files;
        }

        return files.filter((file) =>
            file.originalName.toLowerCase().includes(normalizedQuery),
        );
    }, [fileSearchQuery, files]);

    const filteredVectorStorages = useMemo(() => {
        const normalizedQuery = vectorSearchQuery.trim().toLowerCase();
        const selectedTagIds = new Set(vectorTagFilters);

        return vectorStorages.filter((vectorStorage) => {
            if (selectedTagIds.size > 0) {
                const storageTagIds = new Set(
                    (vectorStorage.tags ?? []).map((tag) => tag.id),
                );

                const hasAllTags = Array.from(selectedTagIds).every((tagId) =>
                    storageTagIds.has(tagId),
                );

                if (!hasAllTags) {
                    return false;
                }
            }

            if (!normalizedQuery) {
                return true;
            }

            const tagsText = vectorStorage.tags
                ? vectorStorage.tags.map((tag) => tag.name).join(" ")
                : "";
            const haystack =
                `${vectorStorage.name} ${vectorStorage.id} ${tagsText}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [vectorSearchQuery, vectorStorages, vectorTagFilters]);

    const vectorTagOptions = storageStore.vectorTags.map((tag) => ({
        value: tag.id,
        label: tag.name,
        description: tag.id,
    }));

    const filteredStorageFilesForPick = useMemo(() => {
        const normalizedQuery = storageFilesSearchQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return files.filter((file) => {
                const extension = file.originalName.toLowerCase();
                return (
                    extension.endsWith(".pdf") || extension.endsWith(".docx")
                );
            });
        }

        return files.filter((file) => {
            const extension = file.originalName.toLowerCase();
            if (!extension.endsWith(".pdf") && !extension.endsWith(".docx")) {
                return false;
            }

            return file.originalName.toLowerCase().includes(normalizedQuery);
        });
    }, [files, storageFilesSearchQuery]);

    const preparedStorageFileIds = useMemo(
        () =>
            preparedVectorFiles
                .map((file) => file.storageFileId)
                .filter((fileId): fileId is string => Boolean(fileId)),
        [preparedVectorFiles],
    );

    const preparedUploadedFiles = useMemo(
        () =>
            preparedVectorFiles
                .map((file) => file.uploadedFile)
                .filter((uploadedFile): uploadedFile is UploadedFileData =>
                    Boolean(uploadedFile),
                ),
        [preparedVectorFiles],
    );

    const containedFiles = (() => {
        const selectedStorage = storageStore.selectedVectorStorage;

        if (!selectedStorage) {
            return [];
        }

        const byId = new Map(files.map((file) => [file.id, file]));

        return selectedStorage.fileIds
            .map((fileId) => byId.get(fileId))
            .filter((file): file is (typeof files)[number] => Boolean(file));
    })();

    const openSelectedFile = async () => {
        const selectedFile = storageStore.selectedFile;

        if (!selectedFile) {
            return;
        }

        const isOpened = await openFile(selectedFile.id);

        if (isOpened) {
            return;
        }

        toasts.warning({
            title: "Не удалось открыть файл",
            description: "Файл недоступен или был перемещён.",
        });
    };

    const openSelectedFileProject = () => {
        const selectedFileProjectRef = storageStore.selectedFileProjectRef;
        const targetProjectId = selectedFileProjectRef?.id;

        if (!targetProjectId) {
            toasts.info({
                title: "Проект не найден",
                description: "Этот файл не привязан к проекту.",
            });
            return;
        }

        navigate(`/workspace/projects/${targetProjectId}`);
    };

    const deleteSelectedFile = async () => {
        const selectedFile = storageStore.selectedFile;

        if (!selectedFile) {
            return;
        }

        const isDeleted = await deleteFile(selectedFile.id);

        if (!isDeleted) {
            toasts.warning({
                title: "Не удалось удалить файл",
                description: "Попробуйте ещё раз.",
            });
            return;
        }

        await Promise.all([
            storageStore.loadFilesData(),
            storageStore.loadVectorStoragesData(),
        ]);

        toasts.success({
            title: "Файл удалён",
            description: `${selectedFile.originalName} удалён из хранилища.`,
        });
    };

    const openDeleteConfirmModal = () => {
        if (!storageStore.selectedVectorStorage) {
            toasts.info({
                title: "Стор не выбран",
                description: "Выберите векторное хранилище для удаления.",
            });
            return;
        }

        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteVectorStorage = async () => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            setIsDeleteConfirmOpen(false);
            return;
        }

        const isDeleted = await deleteVectorStorage(selectedVectorStorage.id);

        if (isDeleted) {
            setIsDeleteConfirmOpen(false);
        }
    };

    const addFilesFromExplorer = async () => {
        const pickedFiles = await pickFiles({
            accept: [".pdf", ".docx"],
            multiple: true,
        });

        if (!pickedFiles.length) {
            return;
        }

        const nextPrepared: PreparedVectorFile[] = pickedFiles.map((file) => ({
            localId: `upload_${crypto.randomUUID()}`,
            source: "upload",
            name: file.name,
            size: file.size,
            uploadedFile: file,
        }));

        setPreparedVectorFiles((previous) => [...previous, ...nextPrepared]);
    };

    const toggleStorageFileForPick = (fileId: string, checked: boolean) => {
        setPickedStorageFileIds((previous) => {
            if (checked) {
                return [...new Set([...previous, fileId])];
            }

            return previous.filter((currentFileId) => currentFileId !== fileId);
        });
    };

    const confirmPickedStorageFiles = () => {
        const preparedIds = new Set(preparedStorageFileIds);
        const selectedRecords = files.filter((file) =>
            pickedStorageFileIds.includes(file.id),
        );

        const nextPrepared = selectedRecords
            .filter((file) => !preparedIds.has(file.id))
            .map((file) => ({
                localId: `storage_${file.id}`,
                source: "storage" as const,
                name: file.originalName,
                size: file.size,
                storageFileId: file.id,
            }));

        setPreparedVectorFiles((previous) => [...previous, ...nextPrepared]);
        setIsStorageFilesPickOpen(false);
    };

    const removePreparedFile = (localId: string) => {
        setPreparedVectorFiles((previous) =>
            previous.filter((preparedFile) => preparedFile.localId !== localId),
        );
    };

    const runVectorization = async () => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            toasts.info({
                title: "Стор не выбран",
                description: "Выберите векторное хранилище для запуска.",
            });
            return;
        }

        if (!preparedVectorFiles.length) {
            toasts.info({
                title: "Файлы не выбраны",
                description:
                    "Добавьте PDF/DOCX файлы из проводника или из хранилища.",
            });
            return;
        }

        toasts.info({
            title: "Запуск векторизации",
            description: "Создаю фоновую задачу...",
        });

        const created = await createJob({
            kind: "vectorization",
            name: `vectorize_${selectedVectorStorage.name}`,
            description: `Индексация файлов в ${selectedVectorStorage.name}`,
            vectorStorageId: selectedVectorStorage.id,
            sourceFileIds: preparedStorageFileIds,
            uploadedFiles: preparedUploadedFiles,
        });

        if (!created) {
            return;
        }

        setPreparedVectorFiles([]);
        setPickedStorageFileIds([]);
        await Promise.all([
            storageStore.loadFilesData(),
            storageStore.loadVectorStoragesData(),
        ]);
    };

    const changeVectorStorageDataPath = async () => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            toasts.info({
                title: "Стор не выбран",
                description: "Выберите векторное хранилище.",
            });
            return;
        }

        const pickedDirectory = await pickPath({ forFolders: true });

        if (!pickedDirectory) {
            return;
        }

        const updated = await storageStore.updateVectorStorage(
            selectedVectorStorage.id,
            {
                dataPath: pickedDirectory,
            },
        );

        if (!updated) {
            toasts.warning({
                title: "Не удалось обновить путь",
                description: "Попробуйте ещё раз.",
            });
            return;
        }

        await storageStore.loadVectorStoragesData();

        toasts.success({
            title: "Путь данных обновлён",
            description: "Путь к индексу был изменён.",
        });
    };

    const openVectorStorageFolder = async () => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            toasts.info({
                title: "Стор не выбран",
                description: "Выберите векторное хранилище.",
            });
            return;
        }

        const dataPath = selectedVectorStorage.dataPath.trim();

        if (!dataPath) {
            toasts.warning({
                title: "Путь к данным не задан",
                description: "У этого хранилища нет пути к индексу.",
            });
            return;
        }

        const isOpened = await openPath(dataPath);

        if (isOpened) {
            return;
        }

        toasts.warning({
            title: "Не удалось открыть папку",
            description: "Папка недоступна или была перемещена.",
        });
    };

    const saveVectorStorageName = async () => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            return;
        }

        const normalizedName = editableVectorStorageName.trim();

        if (!normalizedName) {
            toasts.info({
                title: "Название пустое",
                description: "Введите название хранилища.",
            });
            return;
        }

        if (normalizedName === selectedVectorStorage.name) {
            return;
        }

        try {
            setIsVectorStorageNameSaving(true);
            const updated = await storageStore.updateVectorStorage(
                selectedVectorStorage.id,
                {
                    name: normalizedName,
                },
            );

            toasts.success({
                title: "Успех!",
                description: "Название хранилища было обновлено.",
            });

            if (!updated) {
                toasts.warning({
                    title: "Не удалось обновить название",
                    description: "Попробуйте ещё раз.",
                });
            }
        } finally {
            setIsVectorStorageNameSaving(false);
        }
    };

    const createStorageTag = async () => {
        const normalizedName = newVectorTagName.trim();

        if (!normalizedName) {
            toasts.info({
                title: "Название тега пустое",
                description: "Введите название тега.",
            });
            return;
        }

        try {
            setIsVectorTagSaving(true);
            const created = await createVectorTag(normalizedName);

            if (!created) {
                return;
            }

            setNewVectorTagName("");
        } finally {
            setIsVectorTagSaving(false);
        }
    };

    const updateSelectedStorageTags = async (tagIds: string[]) => {
        const selectedVectorStorage = storageStore.selectedVectorStorage;

        if (!selectedVectorStorage) {
            return;
        }

        const updated = await storageStore.updateVectorStorage(
            selectedVectorStorage.id,
            {
                tagIds,
            },
        );

        if (!updated) {
            toasts.warning({
                title: "Не удалось обновить теги",
                description: "Попробуйте ещё раз.",
            });
        }
    };

    const isActiveViewLoading =
        activeView === "files"
            ? storageStore.isFilesLoading
            : storageStore.isVectorStoragesLoading;

    if (isActiveViewLoading) {
        return <LoadingFallbackPage title="Загрузка хранилища..." />;
    }

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="rounded-2xl border border-main-700/70 bg-main-900/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-main-100">
                            Хранилище
                        </h2>
                    </div>
                </div>

                <div className="mt-4">
                    <Switcher
                        value={activeView}
                        options={STORAGE_VIEW_OPTIONS}
                        onChange={(nextValue) =>
                            setActiveView(nextValue as StorageView)
                        }
                    />
                </div>
            </div>

            {activeView === "files" ? (
                <div className="min-h-0 flex-1 rounded-2xl bg-main-900/60">
                    <div className="grid h-full min-h-0 grid-cols-[360px_1fr] gap-3">
                        <div className="flex min-h-0 flex-col gap-3 border-r border-main-700/70 pr-3">
                            <InputSmall
                                value={fileSearchQuery}
                                onChange={(event) =>
                                    setFileSearchQuery(event.target.value)
                                }
                                placeholder="Найти файл..."
                            />

                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {filteredFiles.length > 0 ? (
                                    filteredFiles.map((file) => (
                                        <StoredFileCard
                                            key={file.id}
                                            file={file}
                                            selected={
                                                file.id ===
                                                storageStore.selectedFileId
                                            }
                                            projectRef={
                                                storageStore.projectRefByFileId[
                                                    file.id
                                                ]
                                            }
                                            withOpenIcon={false}
                                            onClick={() => {
                                                storageStore.setSelectedFileId(
                                                    file.id,
                                                );
                                            }}
                                        />
                                    ))
                                ) : (
                                    <div className="rounded-xl border border-dashed border-main-700/70 bg-main-900/40 px-3 py-6 text-center text-sm text-main-400">
                                        Не найдено файлов, соответствующих
                                        запросу.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex min-h-0 flex-col rounded-xl bg-main-900/40 p-4">
                            {storageStore.selectedFile ? (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-semibold text-main-100">
                                                {
                                                    storageStore.selectedFile
                                                        .originalName
                                                }
                                            </p>
                                            <p className="mt-1 text-xs text-main-400">
                                                ID:{" "}
                                                {storageStore.selectedFile.id}
                                            </p>
                                        </div>

                                        <div className="space-x-4">
                                            <Button
                                                variant="primary"
                                                shape="rounded-lg"
                                                className="h-8 px-3 text-xs"
                                                onClick={() => {
                                                    void openSelectedFile();
                                                }}
                                            >
                                                <Icon
                                                    icon="mdi:open-in-new"
                                                    width={16}
                                                />
                                                <span className="ml-1">
                                                    Открыть файл
                                                </span>
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                shape="rounded-lg"
                                                className="h-8 px-3 text-xs"
                                                onClick={() => {
                                                    openSelectedFileProject();
                                                }}
                                            >
                                                <Icon
                                                    icon="mdi:open-in-new"
                                                    width={16}
                                                />
                                                <span className="ml-1">
                                                    Открыть проект
                                                </span>
                                            </Button>
                                            <Button
                                                variant="danger"
                                                shape="rounded-lg"
                                                className="h-8 px-3 text-xs"
                                                onClick={() => {
                                                    void deleteSelectedFile();
                                                }}
                                            >
                                                <Icon
                                                    icon="mdi:trash-can-outline"
                                                    width={16}
                                                />
                                                <span className="ml-1">
                                                    Удалить файл
                                                </span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2 text-sm">
                                        <div className="rounded-lg border border-main-700/70 bg-main-900/60 px-3 py-2">
                                            <p className="text-xs text-main-400">
                                                Путь
                                            </p>
                                            <p className="truncate text-main-200">
                                                {storageStore.selectedFile.path}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-main-700/70 bg-main-900/60 px-3 py-2">
                                            <p className="text-xs text-main-400">
                                                Проект
                                            </p>
                                            <p className="text-main-200">
                                                {storageStore
                                                    .selectedFileProjectRef
                                                    ?.title ||
                                                    "Без привязки к проекту"}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-main-400">
                                    Выберите файл для просмотра деталей.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="min-h-0 flex-1 rounded-2xl bg-main-900/60">
                    <div className="grid h-full min-h-0 grid-cols-[360px_1fr] gap-3">
                        <aside className="flex min-h-0 flex-col gap-3 border-r border-main-700/70 pr-3">
                            <InputSmall
                                value={vectorSearchQuery}
                                onChange={(event) =>
                                    setVectorSearchQuery(event.target.value)
                                }
                                placeholder="Поиск векторного хранилища..."
                            />
                            <AutoFillSelector
                                options={vectorTagOptions}
                                value={vectorTagFilters}
                                onChange={setVectorTagFilters}
                                placeholder="Фильтр по тегам"
                            />

                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {filteredVectorStorages.length > 0 ? (
                                    filteredVectorStorages.map(
                                        (vectorStorage) => (
                                            <button
                                                key={vectorStorage.id}
                                                type="button"
                                                className={`w-full rounded-xl px-3 py-3 text-left transition-colors cursor-pointer ${
                                                    vectorStorage.id ===
                                                    storageStore.selectedVectorStorageId
                                                        ? " bg-main-800/80"
                                                        : "bg-main-900/55 hover:bg-main-800/70"
                                                }`}
                                                onClick={() => {
                                                    storageStore.setSelectedVectorStorageId(
                                                        vectorStorage.id,
                                                    );
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="truncate text-sm font-medium text-main-100">
                                                        {vectorStorage.name}
                                                    </p>
                                                    <p className="text-xs text-main-400">
                                                        {formatDateTime(
                                                            vectorStorage.createdAt,
                                                        )}
                                                    </p>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-main-400">
                                                    id: {vectorStorage.id}
                                                </p>
                                            </button>
                                        ),
                                    )
                                ) : (
                                    <div className="rounded-xl border border-dashed border-main-700/70 bg-main-900/40 px-3 py-6 text-center text-sm text-main-400">
                                        Векторные хранилища не найдены.
                                    </div>
                                )}
                            </div>
                        </aside>

                        <section className="min-h-0 overflow-y-auto rounded-xl bg-main-900/40 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.16em] text-main-400">
                                        Векторное хранилище
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-main-100">
                                        {storageStore.selectedVectorStorage
                                            ?.name || "Без названия"}
                                    </h3>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Button
                                        variant="success"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            void runVectorization();
                                        }}
                                    >
                                        <Icon
                                            icon="mdi:play-circle-outline"
                                            className="text-main-900"
                                            width={16}
                                        />
                                        <span className="ml-1 text-main-900">
                                            Индекс
                                        </span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            void addFilesFromExplorer();
                                        }}
                                        disabled={isUploading}
                                    >
                                        <Icon
                                            icon="mdi:file-upload-outline"
                                            width={16}
                                        />
                                        <span className="ml-1">
                                            Добавить файл
                                        </span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            setPickedStorageFileIds(
                                                preparedStorageFileIds,
                                            );
                                            setIsStorageFilesPickOpen(true);
                                        }}
                                    >
                                        <Icon
                                            icon="mdi:database-search-outline"
                                            width={16}
                                        />
                                        <span className="ml-1">
                                            Из хранилища
                                        </span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            void openVectorStorageFolder();
                                        }}
                                    >
                                        <Icon
                                            icon="mdi:folder-open-outline"
                                            width={16}
                                        />
                                        <span className="ml-1">
                                            Открыть папку
                                        </span>
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            void changeVectorStorageDataPath();
                                        }}
                                        disabled={isPickingPath}
                                    >
                                        <Icon
                                            icon="mdi:folder-edit-outline"
                                            width={16}
                                        />
                                        <span className="ml-1">
                                            Изменить путь к данным
                                        </span>
                                    </Button>
                                    <Button
                                        variant="primary"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            void createVectorStorage();
                                        }}
                                    >
                                        <Icon icon="mdi:plus" width={16} />
                                        <span className="ml-1">
                                            Создать новое
                                        </span>
                                    </Button>
                                    <Button
                                        variant="danger"
                                        shape="rounded-full"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => {
                                            openDeleteConfirmModal();
                                        }}
                                    >
                                        <Icon
                                            icon="mdi:trash-can-outline"
                                            width={16}
                                        />
                                    </Button>
                                </div>
                            </div>

                            {storageStore.selectedVectorStorage ? (
                                <>
                                    <div className="rounded-xl bg-main-900/45">
                                        <p className="text-xs text-main-400">
                                            Название хранилища
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <InputSmall
                                                value={
                                                    editableVectorStorageName
                                                }
                                                onChange={(event) =>
                                                    setEditableVectorStorageName(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Введите название"
                                            />
                                            <Button
                                                variant="primary"
                                                shape="rounded-lg"
                                                className="h-9 px-3 text-xs shrink-0"
                                                onClick={() => {
                                                    void saveVectorStorageName();
                                                }}
                                                disabled={
                                                    isVectorStorageNameSaving
                                                }
                                            >
                                                Сохранить
                                            </Button>
                                        </div>
                                    </div>

                                    <PrettyBR label="Теги" icon="mdi:tag" />

                                    <div className="mt-4 rounded-xl bg-main-900/45">
                                        <div className="mt-3 flex items-center gap-2">
                                            <InputSmall
                                                value={newVectorTagName}
                                                onChange={(event) =>
                                                    setNewVectorTagName(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Новый тег"
                                            />
                                            <Button
                                                variant="secondary"
                                                shape="rounded-lg"
                                                className="h-9 px-3 text-xs shrink-0"
                                                onClick={() => {
                                                    void createStorageTag();
                                                }}
                                                disabled={isVectorTagSaving}
                                            >
                                                Добавить тег
                                            </Button>
                                        </div>
                                        <AutoFillSelector
                                            className="mt-3"
                                            options={vectorTagOptions}
                                            value={(
                                                storageStore
                                                    .selectedVectorStorage
                                                    .tags ?? []
                                            ).map((tag) => tag.id)}
                                            onChange={(nextTagIds) => {
                                                void updateSelectedStorageTags(
                                                    nextTagIds,
                                                );
                                            }}
                                            placeholder="Назначьте теги хранилищу"
                                        />
                                    </div>

                                    <PrettyBR
                                        label="Детали хранилища"
                                        icon="mdi:information-outline"
                                    />

                                    <div className="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                                        <p className="text-main-400">ID</p>
                                        <p className="text-main-200">
                                            {
                                                storageStore
                                                    .selectedVectorStorage.id
                                            }
                                        </p>
                                        <p className="text-main-400">Размер</p>
                                        <p className="text-main-200">
                                            {formatFileSize(
                                                storageStore
                                                    .selectedVectorStorage.size,
                                            )}
                                        </p>
                                        <p className="text-main-400">
                                            Файл индекса
                                        </p>
                                        <p className="break-all text-main-200">
                                            {storageStore.selectedVectorStorage
                                                .dataPath || "Не указана"}
                                        </p>
                                        <p className="text-main-400">
                                            Последняя активность
                                        </p>
                                        <p className="text-main-200">
                                            {formatDateTime(
                                                storageStore
                                                    .selectedVectorStorage
                                                    .lastActiveAt,
                                            )}
                                        </p>
                                        <p className="text-main-400">Создано</p>
                                        <p className="text-main-200">
                                            {formatDateTime(
                                                storageStore
                                                    .selectedVectorStorage
                                                    .createdAt,
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-4 rounded-xl border border-yellow-600/70 bg-yellow-800/45 p-3 text-sm text-yellow-200">
                                        <Icon
                                            icon="mdi:warning-outline"
                                            width={20}
                                            className="inline-block mr-3"
                                        />
                                        Для векторизации должна быть запущена
                                        локальная Ollama-модель
                                        <span className="font-semibold">
                                            {" "}
                                            embeddingModel{" "}
                                        </span>
                                        на стандартном порту
                                        <span className="font-semibold">
                                            {" "}
                                            11434
                                        </span>
                                        .
                                    </div>

                                    <PrettyBR
                                        label="Содержимое хранилища"
                                        icon="mdi:database"
                                    />

                                    <div className="mt-4 rounded-xl border border-main-700/70 bg-main-900/45 p-3">
                                        <h4 className="text-sm font-semibold text-main-100">
                                            Подготовленные файлы
                                        </h4>
                                        <div className="mt-3 space-y-2">
                                            {preparedVectorFiles.length > 0 ? (
                                                preparedVectorFiles.map(
                                                    (file) => (
                                                        <div
                                                            key={file.localId}
                                                            className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm text-main-200">
                                                                        {
                                                                            file.name
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-main-400">
                                                                        {file.source ===
                                                                        "upload"
                                                                            ? "Источник: Проводник"
                                                                            : "Источник: Хранилище"}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    variant="secondary"
                                                                    shape="rounded-lg"
                                                                    className="h-7 w-7"
                                                                    onClick={() =>
                                                                        removePreparedFile(
                                                                            file.localId,
                                                                        )
                                                                    }
                                                                >
                                                                    <Icon
                                                                        icon="mdi:close"
                                                                        width={
                                                                            14
                                                                        }
                                                                    />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ),
                                                )
                                            ) : (
                                                <div className="flex h-20 items-center justify-center text-xs text-main-400">
                                                    Добавьте PDF/DOCX файлы для
                                                    векторизации.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-xl border border-main-700/70 bg-main-900/45 p-3">
                                        <h4 className="text-sm font-semibold text-main-100">
                                            Содержащиеся файлы
                                        </h4>
                                        <div className="mt-3 space-y-2">
                                            {containedFiles.length > 0 ? (
                                                containedFiles.map((file) => (
                                                    <div
                                                        key={file.id}
                                                        className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2"
                                                    >
                                                        <p className="truncate text-sm text-main-200">
                                                            {file.originalName}
                                                        </p>
                                                        <p className="text-xs text-main-400">
                                                            {file.id}
                                                        </p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex h-16 items-center justify-center text-xs text-main-400">
                                                    В хранилище пока нет файлов.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-xl border border-main-700/70 bg-main-900/45 p-3">
                                        <h4 className="text-sm font-semibold text-main-100">
                                            Используется в проектах
                                        </h4>
                                        <div className="mt-3 flex h-20 items-center text-xs text-main-400">
                                            {storageStore.selectedVectorStorage
                                                .usedByProjects.length > 0
                                                ? storageStore.selectedVectorStorage.usedByProjects.map(
                                                      (project) => {
                                                          return (
                                                              <Link
                                                                  key={
                                                                      project.id
                                                                  }
                                                                  to={`/workspace/projects/${project.id}`}
                                                                  className="rounded-lg border gap-2 items-center flex border-main-700/70 bg-main-900/55 px-3 py-2 transition-colors group hover:bg-indigo-400 hover:text-main-900"
                                                              >
                                                                  <div className="block group-hover:hidden">
                                                                      <Icon
                                                                          icon="mdi:folder"
                                                                          width={
                                                                              18
                                                                          }
                                                                          height={
                                                                              18
                                                                          }
                                                                      />
                                                                  </div>
                                                                  <div className="hidden group-hover:block">
                                                                      <Icon
                                                                          icon="mdi:open-in-new"
                                                                          width={
                                                                              18
                                                                          }
                                                                          height={
                                                                              18
                                                                          }
                                                                      />
                                                                  </div>
                                                                  <span className="truncate capitalize">
                                                                      {
                                                                          project.title
                                                                      }
                                                                  </span>
                                                              </Link>
                                                          );
                                                      },
                                                  )
                                                : "Не используется ни в одном проекте."}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-main-400">
                                    Выберите векторное хранилище для просмотра.
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}

            <Modal
                open={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                title="Удаление векторного хранилища"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void confirmDeleteVectorStorage();
                            }}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <div className="space-y-2 text-sm text-main-300">
                    <p>Подтвердите удаление выбранного векторного хранилища.</p>
                    <p>
                        <span className="text-main-400">Название:</span>{" "}
                        {storageStore.selectedVectorStorage?.name ||
                            "Не выбрано"}
                    </p>
                </div>
            </Modal>

            <Modal
                open={isStorageFilesPickOpen}
                onClose={() => setIsStorageFilesPickOpen(false)}
                title="Выбор файлов из хранилища"
                className="max-w-4xl min-h-[70vh]"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setIsStorageFilesPickOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={confirmPickedStorageFiles}
                        >
                            Добавить выбранные
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-main-300">
                        Поддерживаются только типы PDF и DOCX
                    </p>
                    <InputSmall
                        value={storageFilesSearchQuery}
                        onChange={(event) =>
                            setStorageFilesSearchQuery(event.target.value)
                        }
                        placeholder="Фильтр по имени файла..."
                    />

                    <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                        {filteredStorageFilesForPick.length > 0 ? (
                            filteredStorageFilesForPick.map((file) => {
                                const isPicked = pickedStorageFileIds.includes(
                                    file.id,
                                );

                                return (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-3 rounded-xl border border-main-700/70 bg-main-900/55 p-2"
                                    >
                                        <InputCheckbox
                                            checked={isPicked}
                                            onChange={(checked) =>
                                                toggleStorageFileForPick(
                                                    file.id,
                                                    checked,
                                                )
                                            }
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-main-100">
                                                {file.originalName}
                                            </p>
                                            <p className="text-xs text-main-400">
                                                {file.id}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="rounded-xl border border-dashed border-main-700/70 px-3 py-6 text-center text-sm text-main-400">
                                Не найдены подходящие PDF/DOCX файлы.
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </section>
    );
});
