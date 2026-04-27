import { useMemo } from "react";
import { Icon } from "@iconify/react";
import type { JobEventRecord, JobRecord } from "../../../../types/ElectronApi";

type StorageRepositorySyncProgressFormProps = {
    open: boolean;
    job: JobRecord | null;
    events: JobEventRecord[];
};

const resolveProgressValue = (
    job: JobRecord | null,
    events: JobEventRecord[],
) => {
    for (const event of events) {
        const matched = event.message.match(/(\d{1,3})%/);

        if (!matched) {
            continue;
        }

        const value = Number(matched[1]);

        if (Number.isFinite(value)) {
            return Math.max(0, Math.min(100, value));
        }
    }

    if (job?.isCompleted) {
        return 100;
    }

    return 0;
};

const resolveStatusText = (job: JobRecord | null) => {
    if (!job) {
        return "Ожидание запуска";
    }

    if (job.isPending) {
        return "Выполняется";
    }

    if (job.isCompleted) {
        return "Завершено";
    }

    return "Остановлено";
};

export const StorageRepositorySyncProgressForm = ({
    job,
    events,
}: StorageRepositorySyncProgressFormProps) => {
    const progress = useMemo(
        () => resolveProgressValue(job, events),
        [events, job],
    );
    const statusText = resolveStatusText(job);

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-main-700/70 bg-main-900/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span className="text-main-200">{statusText}</span>
                    <span className="text-main-300">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-main-700/70">
                    <div
                        className="h-full rounded-full bg-main-300 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {job?.errorMessage ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-sm text-rose-200">
                    {job.errorMessage}
                </div>
            ) : null}

            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                {events.length > 0 ? (
                    events.slice(0, 30).map((event) => (
                        <div
                            key={event.id}
                            className="rounded-lg border border-main-700/50 bg-main-900/45 px-3 py-2"
                        >
                            <div className="mb-1 flex items-center gap-2 text-xs text-main-300">
                                <Icon
                                    icon="mdi:timeline-clock-outline"
                                    width={14}
                                    height={14}
                                />
                                <span>{event.createdAt}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-main-100">
                                {event.message}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-main-300">
                        Ожидание событий задачи...
                    </p>
                )}
            </div>
        </div>
    );
};
