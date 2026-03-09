import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { Icon } from "@iconify/react";
import {
    useToasts,
    useVectorStorageTags,
    useVectorStorages,
} from "../../../hooks";
import { useFileSave } from "../../../hooks/files";
import { Button, InputSmall, PrettyBR, Switcher } from "../../components/atoms";
import { StoredFileCard } from "../../components/molecules/cards/storage";
import { LoadingFallbackPage } from "../LoadingFallbackPage";
import { storageStore } from "../../../stores/storageStore";

type StorageView = "files" | "vector-stores";

const STORAGE_VIEW_OPTIONS: { value: StorageView; label: string }[] = [
    { value: "files", label: "Файлы" },
    { value: "vector-stores", label: "Векторное хранилище" },
];

export const StoragePage = observer(function StoragePage() {
    const toasts = useToasts();
    const { openFile, deleteFile } = useFileSave();
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState<StorageView>("files");
    const [fileSearchQuery, setFileSearchQuery] = useState("");
    const [vectorSearchQuery, setVectorSearchQuery] = useState("");
    const [debouncedVectorSearchQuery, setDebouncedVectorSearchQuery] =
        useState("");
    const [selectedVectorTagIds, setSelectedVectorTagIds] = useState<string[]>(
        [],
    );
    const lastStorageErrorRef = useRef("");
    const lastTagsErrorRef = useRef("");

    const files = storageStore.files;
    const vectorStorages = storageStore.vectorStorages;
    const vectorTags = storageStore.vectorTags;
    const selectedVectorStorage = storageStore.selectedVectorStorage;

    const vectorStoragesQuery = useVectorStorages(
        {
            name: debouncedVectorSearchQuery,
            tagIds: selectedVectorTagIds,
        },
        { enabled: true },
    );
    const vectorTagsQuery = useVectorStorageTags({ enabled: true });

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedVectorSearchQuery(vectorSearchQuery);
        }, 350);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [vectorSearchQuery]);

    useEffect(() => {
        if (!vectorStoragesQuery.error) {
            return;
        }

        const description =
            vectorStoragesQuery.error.message ||
            "Не удалось загрузить векторные хранилища.";

        if (description === lastStorageErrorRef.current) {
            return;
        }

        lastStorageErrorRef.current = description;
        toasts.danger({
            title: "Ошибка загрузки хранилищ",
            description,
        });
    }, [vectorStoragesQuery.error, toasts]);

    useEffect(() => {
        if (!vectorTagsQuery.error) {
            return;
        }

        const description =
            vectorTagsQuery.error.message || "Не удалось загрузить теги.";

        if (description === lastTagsErrorRef.current) {
            return;
        }

        lastTagsErrorRef.current = description;
        toasts.danger({
            title: "Ошибка загрузки тегов",
            description,
        });
    }, [vectorTagsQuery.error, toasts]);

    useEffect(() => {
        void storageStore.loadFilesData();
    }, []);

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

    const filteredVectorStorages = vectorStorages;

    const containedFiles = (() => {
        if (!selectedVectorStorage) {
            return [];
        }

        const byId = new Map(files.map((file) => [file.id, file]));

        return selectedVectorStorage.fileIds
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
            vectorStoragesQuery.refetch(),
        ]);

        toasts.success({
            title: "Файл удалён",
            description: `${selectedFile.originalName} удалён из хранилища.`,
        });
    };

    const isActiveViewLoading =
        activeView === "files"
            ? storageStore.isFilesLoading
            : vectorStoragesQuery.isLoading;

    const refreshVectorData = async () => {
        const [storagesResult, tagsResult] = await Promise.all([
            vectorStoragesQuery.refetch(),
            vectorTagsQuery.refetch(),
        ]);

        if (storagesResult.error || tagsResult.error) {
            toasts.danger({
                title: "Ошибка обновления",
                description:
                    storagesResult.error?.message ??
                    tagsResult.error?.message ??
                    "Не удалось обновить данные векторного хранилища.",
            });
            return;
        }

        toasts.success({
            title: "Обновлено",
            description: "Список хранилищ и тегов успешно обновлён.",
        });
    };

    if (isActiveViewLoading) {
        return <LoadingFallbackPage title="Загрузка хранилища..." />;
    }

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="rounded-2xl border border-main-700/70 bg-main-900/60 p-3">
                <h2 className="text-lg font-semibold text-main-100">
                    Хранилище
                </h2>

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

                            <div className="rounded-xl border border-main-700/70 bg-main-900/45 p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs uppercase tracking-[0.12em] text-main-400">
                                        Фильтр по тегам
                                    </p>
                                    <button
                                        type="button"
                                        className="text-xs text-main-300 transition-colors hover:text-main-100"
                                        onClick={() =>
                                            setSelectedVectorTagIds([])
                                        }
                                        disabled={
                                            selectedVectorTagIds.length === 0
                                        }
                                    >
                                        Очистить
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {vectorTags.length > 0 ? (
                                        vectorTags.map((tag) => {
                                            const isSelected =
                                                selectedVectorTagIds.includes(
                                                    tag.id,
                                                );

                                            return (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                                                        isSelected
                                                            ? "border-main-200 bg-main-100 text-main-900"
                                                            : "border-main-700/70 bg-main-900/55 text-main-200 hover:bg-main-800/70"
                                                    }`}
                                                    onClick={() => {
                                                        setSelectedVectorTagIds(
                                                            (previous) =>
                                                                isSelected
                                                                    ? previous.filter(
                                                                          (
                                                                              current,
                                                                          ) =>
                                                                              current !==
                                                                              tag.id,
                                                                      )
                                                                    : [
                                                                          ...previous,
                                                                          tag.id,
                                                                      ],
                                                        );
                                                    }}
                                                >
                                                    {tag.name}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-main-400">
                                            Теги недоступны.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-8 px-3 text-xs"
                                onClick={() => {
                                    void refreshVectorData();
                                }}
                                disabled={
                                    vectorStoragesQuery.isFetching ||
                                    vectorTagsQuery.isFetching
                                }
                            >
                                <Icon icon="mdi:refresh" width={16} />
                                <span className="ml-1">
                                    {vectorStoragesQuery.isFetching ||
                                    vectorTagsQuery.isFetching
                                        ? "Обновление..."
                                        : "Обновить"}
                                </span>
                            </Button>

                            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {filteredVectorStorages.length > 0 ? (
                                    filteredVectorStorages.map(
                                        (vectorStorage) => (
                                            <div
                                                key={vectorStorage.id}
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
                                            </div>
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
                            {selectedVectorStorage ? (
                                <>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.16em] text-main-400">
                                            Векторное хранилище
                                        </p>
                                        <h3 className="mt-1 text-lg font-semibold text-main-100">
                                            {selectedVectorStorage.name ||
                                                "Без названия"}
                                        </h3>
                                    </div>

                                    <div className="mt-4 grid grid-cols-[180px_1fr] gap-y-2 text-sm">
                                        <p className="text-main-400">ID</p>
                                        <p className="text-main-200">
                                            {selectedVectorStorage.id}
                                        </p>
                                        <p className="text-main-400">Размер</p>
                                        <p className="text-main-200">
                                            {formatFileSize(
                                                selectedVectorStorage.size,
                                            )}
                                        </p>
                                        <p className="text-main-400">
                                            Последняя активность
                                        </p>
                                        <p className="text-main-200">
                                            {formatDateTime(
                                                selectedVectorStorage.lastActiveAt,
                                            )}
                                        </p>
                                        <p className="text-main-400">Создано</p>
                                        <p className="text-main-200">
                                            {formatDateTime(
                                                selectedVectorStorage.createdAt,
                                            )}
                                        </p>
                                    </div>

                                    <PrettyBR label="Теги" icon="mdi:tags" />

                                    <div className="mt-4 rounded-xl bg-main-900/45">
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {selectedVectorStorage.tags.length >
                                            0 ? (
                                                selectedVectorStorage.tags.map(
                                                    (tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className="rounded-lg border border-main-700/70 bg-main-900/55 px-2 py-1 text-xs text-main-200"
                                                        >
                                                            {tag.name}
                                                        </span>
                                                    ),
                                                )
                                            ) : (
                                                <p className="text-xs text-main-400">
                                                    Теги загружаются с
                                                    удалённого сервера.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <PrettyBR
                                        label="Содержащиеся файлы"
                                        icon="mdi:file"
                                    />

                                    <div className="mt-4 rounded-xl bg-main-900/45">
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
                                                <div className="flex h-16 items-center text-xs text-main-400">
                                                    В хранилище пока нет файлов.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <PrettyBR
                                        label="Содержащиеся файлы"
                                        icon="mdi:folder"
                                    />

                                    <div className="mt-4 rounded-xl bg-main-900/45">
                                        <div className="mt-3 flex h-20 items-center text-xs text-main-400">
                                            {selectedVectorStorage
                                                .usedByProjects.length > 0
                                                ? selectedVectorStorage.usedByProjects.map(
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
        </section>
    );
});
