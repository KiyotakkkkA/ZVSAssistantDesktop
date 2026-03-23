import type {
    CreateJobPayload,
    JobRealtimeEvent,
    JobRecord,
} from "../../models/job";
import { JobsStorage } from "./JobsStorage";
import type { JobWorker } from "./workers/contracts";
import { TestTaskWorker } from "./workers/TestTaskWorker";

type JobRuntime = {
    abortController: AbortController;
};

const isAbortError = (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError";

export class JobService {
    private readonly runtimes = new Map<string, JobRuntime>();
    private readonly workersByKind = new Map<string, JobWorker>();

    constructor(
        private readonly jobsStorage: JobsStorage,
        private readonly emitEvent: (event: JobRealtimeEvent) => void,
    ) {
        const testWorker = new TestTaskWorker();
        this.workersByKind.set(testWorker.kind, testWorker);

        this.jobsStorage.markPendingJobsAsInterrupted();
    }

    getJobs(): JobRecord[] {
        return this.jobsStorage.getJobs();
    }

    getJobById(jobId: string): JobRecord | null {
        return this.jobsStorage.getJobById(jobId);
    }

    getJobEvents(jobId: string) {
        return this.jobsStorage.getJobEvents(jobId);
    }

    createJob(payload: CreateJobPayload): JobRecord {
        const createdJob = this.jobsStorage.createJob(payload);
        this.emitJobUpdate(createdJob);

        const startEvent = this.jobsStorage.appendJobEvent(
            createdJob.id,
            "Задача создана и добавлена в очередь выполнения",
            "info",
        );
        this.emitJobEvent(startEvent);

        this.runJob(createdJob, payload);

        return createdJob;
    }

    async cancelJob(jobId: string): Promise<boolean> {
        const runtime = this.runtimes.get(jobId);

        if (!runtime) {
            const job = this.jobsStorage.getJobById(jobId);

            if (!job || !job.isPending) {
                return false;
            }

            const cancelled = this.jobsStorage.updateJob(jobId, {
                isPending: false,
                isCompleted: false,
                finishedAt: new Date().toISOString(),
                errorMessage: "Задача отменена",
            });

            if (!cancelled) {
                return false;
            }

            const event = this.jobsStorage.appendJobEvent(
                jobId,
                "Задача отменена",
                "warning",
            );
            this.emitJobUpdate(cancelled);
            this.emitJobEvent(event);
            return true;
        }

        runtime.abortController.abort();
        return true;
    }

    async shutdown(): Promise<void> {
        const activeJobIds = [...this.runtimes.keys()];

        await Promise.all(activeJobIds.map((jobId) => this.cancelJob(jobId)));
    }

    private runJob(job: JobRecord, payload: CreateJobPayload): void {
        const abortController = new AbortController();
        this.runtimes.set(job.id, { abortController });

        const stageRef = { current: "инициализация" };

        void this.executeJobFlow(job, payload, abortController.signal, stageRef)
            .then((doneMessage) => {
                this.markJobCompleted(job.id, doneMessage);
            })
            .catch((error) => {
                this.markJobFailed(job.id, stageRef.current, error);
            })
            .finally(() => {
                this.runtimes.delete(job.id);
            });
    }

    private async executeJobFlow(
        job: JobRecord,
        payload: CreateJobPayload,
        signal: AbortSignal,
        stageRef: { current: string },
    ): Promise<string> {
        const kind = payload.kind ?? "test-task";
        const worker = this.workersByKind.get(kind);

        if (!worker) {
            throw new Error(`Worker for job kind '${kind}' is not implemented`);
        }

        return worker.run({
            job,
            payload,
            signal,
            emitStage: (message, tag = "info") => {
                stageRef.current = message;
                const progressEvent = this.jobsStorage.appendJobEvent(
                    job.id,
                    message,
                    tag,
                );
                this.emitJobEvent(progressEvent);
            },
            delay: (ms) => this.delay(ms, signal),
        });
    }

    private markJobCompleted(jobId: string, doneMessage: string): void {
        const completed = this.jobsStorage.updateJob(jobId, {
            isCompleted: true,
            isPending: false,
            finishedAt: new Date().toISOString(),
            errorMessage: null,
        });

        if (completed) {
            this.emitJobUpdate(completed);
        }

        const doneEvent = this.jobsStorage.appendJobEvent(
            jobId,
            doneMessage,
            "success",
        );
        this.emitJobEvent(doneEvent);
    }

    private markJobFailed(
        jobId: string,
        currentStage: string,
        error: unknown,
    ): void {
        const isAbort = isAbortError(error);
        const normalizedError =
            error instanceof Error
                ? error
                : new Error("Неизвестная ошибка выполнения задачи");
        const stageAwareErrorMessage = isAbort
            ? `Задача отменена (стадия: ${currentStage})`
            : `[${currentStage}] ${normalizedError.message}`;

        const nextJob = this.jobsStorage.updateJob(jobId, {
            isCompleted: false,
            isPending: false,
            finishedAt: new Date().toISOString(),
            errorMessage: stageAwareErrorMessage,
        });

        if (nextJob) {
            this.emitJobUpdate(nextJob);
        }

        const event = this.jobsStorage.appendJobEvent(
            jobId,
            isAbort
                ? `Выполнение прервано пользователем на стадии: ${currentStage}`
                : [
                      "Задача завершилась с ошибкой",
                      `Стадия: ${currentStage}`,
                      `Сообщение: ${normalizedError.message}`,
                      normalizedError.stack
                          ? `Stack:\n${normalizedError.stack}`
                          : "",
                  ]
                      .filter(Boolean)
                      .join("\n\n"),
            isAbort ? "warning" : "error",
        );
        this.emitJobEvent(event);
    }

    private emitJobUpdate(job: JobRecord): void {
        this.emitEvent({
            type: "job.updated",
            job,
        });
    }

    private emitJobEvent(event: {
        id: string;
        jobId: string;
        message: string;
        tag: "info" | "success" | "warning" | "error";
        createdAt: string;
        createdBy: string;
    }): void {
        this.emitEvent({
            type: "job.event.created",
            event,
        });
    }

    private delay(ms: number, signal: AbortSignal): Promise<void> {
        if (signal.aborted) {
            return Promise.reject(new DOMException("Aborted", "AbortError"));
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                signal.removeEventListener("abort", onAbort);
                resolve();
            }, ms);

            const onAbort = () => {
                clearTimeout(timeoutId);
                signal.removeEventListener("abort", onAbort);
                reject(new DOMException("Aborted", "AbortError"));
            };

            signal.addEventListener("abort", onAbort, { once: true });
        });
    }
}
