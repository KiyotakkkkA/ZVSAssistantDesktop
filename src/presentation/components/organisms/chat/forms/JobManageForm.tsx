import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
    Button,
    InputSmall,
    PrettyBR,
    Select,
} from "@kiyotakkkka/zvs-uikit-lib";
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
        return "bg-sky-900/25 text-sky-300";
    }

    if (job.isCompleted) {
        return "bg-emerald-900/25 text-emerald-300";
    }

    return "bg-amber-900/25 text-amber-300";
};

const resolveTagClass = (tag: JobEventTag) => {
    if (tag === "success") {
        return "bg-emerald-900/20 text-emerald-300";
    }

    if (tag === "warning") {
        return "bg-amber-900/20 text-amber-300";
    }

    if (tag === "error") {
        return "bg-rose-900/20 text-rose-300";
    }

    return "bg-main-800/80 text-main-300";
};

const resolveStageCardClass = (tag: JobEventTag) => {
    if (tag === "success") {
        return "border-l-emerald-400/70 bg-emerald-950/15";
    }

    if (tag === "warning") {
        return "border-l-amber-400/70 bg-amber-950/15";
    }

    if (tag === "error") {
        return "border-l-rose-400/70 bg-rose-950/15";
    }

    return "border-l-main-500/80 bg-main-900/45";
};

const resolveStageIcon = (tag: JobEventTag) => {
    if (tag === "success") {
        return "mdi:check-circle-outline";
    }

    if (tag === "warning") {
        return "mdi:alert-outline";
    }

    if (tag === "error") {
        return "mdi:close-circle-outline";
    }

    return "mdi:information-outline";
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
        <div className="flex h-full min-h-[68vh] flex-col gap-4 animate-page-fade-in lg:flex-row">
            <aside className="flex min-h-0 w-full flex-col p-3 animate-panel-slide-in lg:w-85 lg:max-w-85 lg:shrink-0 border-r border-main-600/65">
                <div className="space-y-3 rounded-xl animate-card-rise-in z-40">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-main-400">
                                Список задач
                            </p>
                            <p className="mt-1 text-sm font-semibold text-main-100">
                                Фоновые операции
                            </p>
                        </div>
                        <span className="rounded-full bg-main-700/70 px-2.5 py-1 text-xs text-main-200">
                            {filteredAndSortedJobs.length} шт.
                        </span>
                    </div>

                    <InputSmall
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Поиск по имени, описанию или ID"
                    />

                    <div className="space-y-2">
                        <Select
                            value={statusFilter}
                            onChange={(value) =>
                                setStatusFilter(value as JobStatusFilter)
                            }
                            options={STATUS_FILTER_OPTIONS}
                            className="bg-main-700/45 min-w-79"
                        />
                        <Select
                            value={jobSort}
                            onChange={(value) => setJobSort(value as JobSort)}
                            options={JOB_SORT_OPTIONS}
                            className="bg-main-700/45 min-w-79"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="hover:-translate-y-0.5 p-1 transition-transform"
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
                            className="hover:-translate-y-0.5 p-1 transition-transform flex-1"
                            onClick={() => {
                                void handleRefresh();
                            }}
                        >
                            <Icon icon="mdi:refresh" width={16} />
                            <span className="ml-1">Обновить</span>
                        </Button>
                    </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 z-0">
                    {isLoading ? (
                        <div className="rounded-xl bg-main-900/48 px-3 py-6 text-center text-sm text-main-300 animate-card-rise-in">
                            Загрузка задач...
                        </div>
                    ) : filteredAndSortedJobs.length > 0 ? (
                        filteredAndSortedJobs.map((job, index) => (
                            <button
                                key={job.id}
                                type="button"
                                className={`w-full cursor-pointer rounded-xl px-3 py-3 text-left transition-all duration-200 animate-card-rise-in ${
                                    job.id === selectedJobId
                                        ? "bg-main-800/90 shadow-[0_0_0_1px_rgba(245,245,245,0.04)]"
                                        : "bg-main-900/48 hover:bg-main-800/62"
                                }`}
                                style={{
                                    animationDelay: `${50 + index * 28}ms`,
                                }}
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
                                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${resolveStatusBadgeClass(job)}`}
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
                        <div className="rounded-xl bg-main-900/36 px-3 py-6 text-center text-sm text-main-400 animate-card-rise-in">
                            Задачи не найдены.
                        </div>
                    )}
                </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl p-4 animate-card-rise-in">
                {selectedJob ? (
                    <>
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 animate-card-rise-in">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.14em] text-main-400">
                                    Детали задачи
                                </p>
                                <h3 className="truncate text-lg font-semibold text-main-100">
                                    {selectedJob.name}
                                </h3>
                            </div>

                            <div className="flex items-center gap-2">
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${resolveStatusBadgeClass(selectedJob)}`}
                                >
                                    {selectedJobStatus}
                                </span>
                                <Button
                                    variant="danger"
                                    shape="rounded-lg"
                                    className="h-9 px-3 text-xs transition-all duration-200 hover:-translate-y-0.5"
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
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                            <div className="rounded-lg bg-main-900/42 px-3 py-2 animate-card-rise-in">
                                <p className="text-xs text-main-400">Статус</p>
                                <p className="text-main-200">
                                    {selectedJobStatus}
                                </p>
                            </div>
                            <div className="rounded-lg bg-main-900/42 px-3 py-2 animate-card-rise-in">
                                <p className="text-xs text-main-400">ID</p>
                                <p className="truncate text-main-200">
                                    {selectedJob.id}
                                </p>
                            </div>
                            <div className="rounded-lg bg-main-900/42 px-3 py-2 animate-card-rise-in">
                                <p className="text-xs text-main-400">Создана</p>
                                <p className="text-main-200">
                                    {selectedJob.createdAt}
                                </p>
                            </div>
                            <div className="rounded-lg bg-main-900/42 px-3 py-2 animate-card-rise-in">
                                <p className="text-xs text-main-400">
                                    Обновлена
                                </p>
                                <p className="text-main-200">
                                    {selectedJob.updatedAt}
                                </p>
                            </div>
                            <div className="rounded-lg bg-main-900/42 px-3 py-2 md:col-span-2 animate-card-rise-in">
                                <p className="text-xs text-main-400">
                                    Описание
                                </p>
                                <p className="text-main-200">
                                    {selectedJob.description || "Без описания"}
                                </p>
                            </div>
                            {selectedJob.errorMessage ? (
                                <div className="rounded-lg bg-rose-900/20 px-3 py-2 md:col-span-2 animate-card-rise-in">
                                    <p className="text-xs text-rose-300">
                                        Ошибка
                                    </p>
                                    <p className="text-sm text-rose-200">
                                        {selectedJob.errorMessage}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="relative z-40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-2 animate-card-rise-in">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-main-100">
                                <Icon icon="mdi:timeline-outline" width={16} />
                                События задачи
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Select
                                    value={eventTagFilter}
                                    onChange={(value) =>
                                        setEventTagFilter(
                                            value as "all" | JobEventTag,
                                        )
                                    }
                                    options={EVENT_TAG_OPTIONS}
                                    className="bg-main-700/45 backdrop-blur-sm"
                                />
                                <Select
                                    value={eventSort}
                                    onChange={(value) =>
                                        setEventSort(value as EventSort)
                                    }
                                    options={EVENT_SORT_OPTIONS}
                                    className="bg-main-700/45 backdrop-blur-sm"
                                />
                            </div>
                        </div>

                        <PrettyBR
                            icon="mdi:information-outline"
                            label="Стадии выполнения"
                            size={20}
                        />

                        <div className="relative z-0 mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                            {filteredAndSortedEvents.length > 0 ? (
                                filteredAndSortedEvents.map((event, index) => (
                                    <div
                                        key={event.id}
                                        className={`animate-card-rise-in rounded-xl border border-main-800/70 border-l-3 px-3 py-2.5 transition-colors duration-200 hover:border-main-700/90 ${resolveStageCardClass(event.tag)}`}
                                        style={{
                                            animationDelay: `${70 + index * 18}ms`,
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="inline-flex items-center gap-1.5">
                                                <Icon
                                                    icon={resolveStageIcon(
                                                        event.tag,
                                                    )}
                                                    width={14}
                                                    className="text-main-400"
                                                />
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${resolveTagClass(event.tag)}`}
                                                >
                                                    {event.tag}
                                                </span>
                                            </div>
                                            <span className="rounded-full bg-main-800/70 px-2 py-0.5 text-[11px] text-main-500">
                                                {event.createdAt}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm leading-5 text-main-200">
                                            {event.message}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl bg-main-900/34 px-3 py-6 text-center text-sm text-main-400 animate-card-rise-in">
                                    Для задачи пока нет событий.
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center rounded-xl bg-main-900/34 px-6 text-center text-sm text-main-400 animate-card-rise-in">
                        Выберите задачу слева, чтобы посмотреть детали и
                        события.
                    </div>
                )}
            </section>
        </div>
    );
};
