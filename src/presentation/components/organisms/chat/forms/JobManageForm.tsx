import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib";
import { useJobs } from "../../../../../hooks";
import type { JobEventTag, JobRecord } from "../../../../../types/ElectronApi";

type JobStatusFilter = "all" | "pending" | "completed" | "stopped";
type JobSort = "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
type EventSort = "created_desc" | "created_asc";

const STATUS_FILTER_OPTIONS = [
    { value: "all", label: "Все статусы" },
    { value: "pending", label: "В процессе" },
    { value: "completed", label: "Успешно" },
    { value: "stopped", label: "Остановлены/с ошибкой" },
];

const JOB_SORT_OPTIONS = [
    { value: "updated_desc", label: "Сначала обновленные" },
    { value: "updated_asc", label: "Сначала старые обновления" },
    { value: "created_desc", label: "Сначала новые" },
    { value: "created_asc", label: "Сначала старые" },
];

const EVENT_SORT_OPTIONS = [
    { value: "created_desc", label: "Сначала новые события" },
    { value: "created_asc", label: "Сначала старые события" },
];

const EVENT_TAG_OPTIONS = [
    { value: "all", label: "Все теги" },
    { value: "info", label: "Info" },
    { value: "success", label: "Success" },
    { value: "warning", label: "Warning" },
    { value: "error", label: "Error" },
];

const resolveStatusLabel = (job: JobRecord) => {
    if (job.isPending) {
        return "В процессе";
    }

    if (job.isCompleted) {
        return "Успешно";
    }

    return "Остановлена";
};

const resolveStatusBadgeClass = (job: JobRecord) => {
    if (job.isPending) {
        return "border-sky-700/70 bg-sky-900/20 text-sky-300";
    }

    if (job.isCompleted) {
        return "border-emerald-700/70 bg-emerald-900/20 text-emerald-300";
    }

    return "border-amber-700/70 bg-amber-900/20 text-amber-300";
};

const resolveTagClass = (tag: JobEventTag) => {
    if (tag === "success") {
        return "border-emerald-700/70 bg-emerald-900/15 text-emerald-300";
    }

    if (tag === "warning") {
        return "border-amber-700/70 bg-amber-900/15 text-amber-300";
    }

    if (tag === "error") {
        return "border-rose-700/70 bg-rose-900/15 text-rose-300";
    }

    return "border-main-600 bg-main-800/70 text-main-300";
};

export const JobManageForm = () => {
    const {
        isLoading,
        jobs,
        selectedJob,
        selectedJobId,
        selectedJobEvents,
        createJob,
        cancelJobById,
        refreshJobs,
        selectJob,
    } = useJobs();

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("all");
    const [jobSort, setJobSort] = useState<JobSort>("updated_desc");
    const [eventTagFilter, setEventTagFilter] = useState<"all" | JobEventTag>(
        "all",
    );
    const [eventSort, setEventSort] = useState<EventSort>("created_desc");

    const filteredAndSortedJobs = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        const byFilter = jobs.filter((job) => {
            if (statusFilter === "pending") {
                return job.isPending;
            }

            if (statusFilter === "completed") {
                return job.isCompleted;
            }

            if (statusFilter === "stopped") {
                return !job.isPending && !job.isCompleted;
            }

            return true;
        });

        const bySearch = normalizedSearch
            ? byFilter.filter((job) =>
                  `${job.name} ${job.description} ${job.id}`
                      .toLowerCase()
                      .includes(normalizedSearch),
              )
            : byFilter;

        return [...bySearch].sort((left, right) => {
            if (jobSort === "updated_asc") {
                return left.updatedAt.localeCompare(right.updatedAt);
            }

            if (jobSort === "created_desc") {
                return right.createdAt.localeCompare(left.createdAt);
            }

            if (jobSort === "created_asc") {
                return left.createdAt.localeCompare(right.createdAt);
            }

            return right.updatedAt.localeCompare(left.updatedAt);
        });
    }, [jobs, jobSort, searchQuery, statusFilter]);

    const filteredAndSortedEvents = useMemo(() => {
        const byTag =
            eventTagFilter === "all"
                ? selectedJobEvents
                : selectedJobEvents.filter(
                      (event) => event.tag === eventTagFilter,
                  );

        return [...byTag].sort((left, right) => {
            if (eventSort === "created_asc") {
                return left.createdAt.localeCompare(right.createdAt);
            }

            return right.createdAt.localeCompare(left.createdAt);
        });
    }, [eventSort, eventTagFilter, selectedJobEvents]);

    const handleCreateJob = async () => {
        const timestamp = new Date().toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        const created = await createJob({
            name: `background_${timestamp}`,
            description: "Фоновая задача для обработки данных",
            kind: "test-task",
            totalSteps: 10,
            stepDelayMs: 700,
        });

        if (created) {
            selectJob(created.job.id);
        }
    };

    const handleRefresh = async () => {
        await refreshJobs();
    };

    const handleCancelSelected = async () => {
        if (!selectedJobId) {
            return;
        }

        await cancelJobById(selectedJobId);
    };

    const selectedJobStatus = selectedJob
        ? resolveStatusLabel(selectedJob)
        : "-";

    return (
        <div className="grid h-full min-h-[68vh] grid-cols-[420px_1fr] gap-4">
            <aside className="flex min-h-0 flex-col rounded-2xl bg-main-900/40 p-2">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-main-100">
                            Список задач
                        </p>
                        <span className="text-xs text-main-400">
                            {filteredAndSortedJobs.length} шт.
                        </span>
                    </div>

                    <InputSmall
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Поиск по имени, описанию или ID"
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <Select
                            value={statusFilter}
                            onChange={(value) =>
                                setStatusFilter(value as JobStatusFilter)
                            }
                            options={STATUS_FILTER_OPTIONS}
                        />
                        <Select
                            value={jobSort}
                            onChange={(value) => setJobSort(value as JobSort)}
                            options={JOB_SORT_OPTIONS}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9"
                            onClick={() => {
                                void handleCreateJob();
                            }}
                        >
                            <Icon icon="mdi:plus" width={16} />
                            <span className="ml-1">Тестовая задача</span>
                        </Button>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9"
                            onClick={() => {
                                void handleRefresh();
                            }}
                        >
                            <Icon icon="mdi:refresh" width={16} />
                            <span className="ml-1">Обновить</span>
                        </Button>
                    </div>
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {isLoading ? (
                        <div className="rounded-xl border border-main-700/70 px-3 py-6 text-center text-sm text-main-400">
                            Загрузка задач...
                        </div>
                    ) : filteredAndSortedJobs.length > 0 ? (
                        filteredAndSortedJobs.map((job) => (
                            <button
                                key={job.id}
                                type="button"
                                className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors ${
                                    job.id === selectedJobId
                                        ? "border-main-500/70 bg-main-800/80"
                                        : "border-main-700/70 bg-main-900/55 hover:bg-main-800/70"
                                }`}
                                onClick={() => {
                                    selectJob(job.id);
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-main-100">
                                            {job.name}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-xs text-main-400">
                                            {job.description || "Без описания"}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${resolveStatusBadgeClass(job)}`}
                                    >
                                        {resolveStatusLabel(job)}
                                    </span>
                                </div>
                                <p className="mt-2 truncate text-[11px] text-main-500">
                                    {job.id}
                                </p>
                            </button>
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-main-700/70 px-3 py-6 text-center text-sm text-main-400">
                            Задачи не найдены.
                        </div>
                    )}
                </div>
            </aside>

            <section className="flex min-h-0 flex-col border-l border-main-700/70 bg-main-900/40 p-4">
                {selectedJob ? (
                    <>
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.14em] text-main-400">
                                    Детали задачи
                                </p>
                                <h3 className="truncate text-lg font-semibold text-main-100">
                                    {selectedJob.name}
                                </h3>
                            </div>

                            <Button
                                variant="danger"
                                shape="rounded-lg"
                                className="h-9 px-3 text-xs"
                                disabled={!selectedJob.isPending}
                                onClick={() => {
                                    void handleCancelSelected();
                                }}
                            >
                                <Icon
                                    icon="mdi:stop-circle-outline"
                                    width={16}
                                />
                                <span className="ml-1">Остановить</span>
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2">
                                <p className="text-xs text-main-400">Статус</p>
                                <p className="text-main-200">
                                    {selectedJobStatus}
                                </p>
                            </div>
                            <div className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2">
                                <p className="text-xs text-main-400">ID</p>
                                <p className="truncate text-main-200">
                                    {selectedJob.id}
                                </p>
                            </div>
                            <div className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2">
                                <p className="text-xs text-main-400">Создана</p>
                                <p className="text-main-200">
                                    {selectedJob.createdAt}
                                </p>
                            </div>
                            <div className="rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2">
                                <p className="text-xs text-main-400">
                                    Обновлена
                                </p>
                                <p className="text-main-200">
                                    {selectedJob.updatedAt}
                                </p>
                            </div>
                            <div className="col-span-2 rounded-lg border border-main-700/70 bg-main-900/55 px-3 py-2">
                                <p className="text-xs text-main-400">
                                    Описание
                                </p>
                                <p className="text-main-200">
                                    {selectedJob.description || "Без описания"}
                                </p>
                            </div>
                            {selectedJob.errorMessage ? (
                                <div className="col-span-2 rounded-lg border border-rose-700/60 bg-rose-900/20 px-3 py-2">
                                    <p className="text-xs text-rose-300">
                                        Ошибка
                                    </p>
                                    <p className="text-sm text-rose-200">
                                        {selectedJob.errorMessage}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-main-100">
                                События задачи
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Select
                                    value={eventTagFilter}
                                    onChange={(value) =>
                                        setEventTagFilter(
                                            value as "all" | JobEventTag,
                                        )
                                    }
                                    options={EVENT_TAG_OPTIONS}
                                />
                                <Select
                                    value={eventSort}
                                    onChange={(value) =>
                                        setEventSort(value as EventSort)
                                    }
                                    options={EVENT_SORT_OPTIONS}
                                />
                            </div>
                        </div>

                        <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                            {filteredAndSortedEvents.length > 0 ? (
                                filteredAndSortedEvents.map((event) => (
                                    <div
                                        key={event.id}
                                        className="rounded-xl border border-main-700/70 bg-main-900/55 px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${resolveTagClass(event.tag)}`}
                                            >
                                                {event.tag}
                                            </span>
                                            <span className="text-xs text-main-500">
                                                {event.createdAt}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-main-200">
                                            {event.message}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl border border-dashed border-main-700/70 px-3 py-6 text-center text-sm text-main-400">
                                    Для задачи пока нет событий.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-main-700/70 text-sm text-main-400">
                        Выберите задачу слева, чтобы посмотреть детали и
                        события.
                    </div>
                )}
            </section>
        </div>
    );
};
