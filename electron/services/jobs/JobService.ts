import type {
    CreateJobPayload,
    JobEventTag,
    JobRecord,
    JobRealtimeEvent,
} from "../../../src/types/ElectronApi";
import { JobsStorage } from "./JobsStorage";
import { VectorizationService } from "../storage/VectorizationService";

type ExtensionsServicePort = {
    installFromGithubRelease: (params: {
        extensionId: string;
        releaseZipUrl: string;
        signal: AbortSignal;
        onStage?: (message: string, tag?: JobEventTag) => void;
    }) => Promise<unknown>;
};

type JobRuntime = {
    abortController: AbortController;
};

export class JobService {
    private readonly runtimes = new Map<string, JobRuntime>();

    constructor(
        private readonly jobsStorage: JobsStorage,
        private readonly vectorizationService: VectorizationService,
        private readonly extensionsService: ExtensionsServicePort,
        private readonly emitEvent: (event: JobRealtimeEvent) => void,
    ) {
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

        await Promise.all(
            activeJobIds.map(async (jobId) => {
                await this.cancelJob(jobId);
            }),
        );
    }

    private runJob(job: JobRecord, payload: CreateJobPayload): void {
        const abortController = new AbortController();
        this.runtimes.set(job.id, { abortController });

        const totalSteps =
            typeof payload.totalSteps === "number" &&
            Number.isFinite(payload.totalSteps)
                ? Math.min(100, Math.max(1, Math.floor(payload.totalSteps)))
                : 8;
        const stepDelayMs =
            typeof payload.stepDelayMs === "number" &&
            Number.isFinite(payload.stepDelayMs)
                ? Math.min(
                      30_000,
                      Math.max(200, Math.floor(payload.stepDelayMs)),
                  )
                : 900;

        const stageRef = { current: "инициализация" };

        void this.executeJobFlow(
            job,
            payload,
            abortController.signal,
            totalSteps,
            stepDelayMs,
            stageRef,
        )
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
        totalSteps: number,
        stepDelayMs: number,
        stageRef: { current: string },
    ): Promise<string> {
        if (payload.kind === "vectorization") {
            await this.vectorizationService.runVectorizationJob(
                payload,
                signal,
                {
                    onStage: (message, tag = "info") => {
                        stageRef.current = message;
                        const progressEvent = this.jobsStorage.appendJobEvent(
                            job.id,
                            message,
                            tag,
                        );
                        this.emitJobEvent(progressEvent);
                    },
                },
            );

            return "Задача векторизации успешно завершена";
        }

        if (payload.kind === "extension-install") {
            const extensionId =
                typeof payload.extensionId === "string"
                    ? payload.extensionId.trim()
                    : "";

            if (!extensionId) {
                throw new Error(
                    "Не передан extensionId для установки расширения",
                );
            }

            await this.extensionsService.installFromGithubRelease({
                extensionId,
                releaseZipUrl: payload.extensionReleaseZipUrl?.trim() ?? "",
                signal,
                onStage: (message, tag = "info") => {
                    stageRef.current = message;
                    const progressEvent = this.jobsStorage.appendJobEvent(
                        job.id,
                        message,
                        tag,
                    );
                    this.emitJobEvent(progressEvent);
                },
            });

            return "Расширение установлено. Перезапустите приложение, чтобы изменения применились во всех сервисах.";
        }

        for (let step = 1; step <= totalSteps; step += 1) {
            await this.delay(stepDelayMs, signal);

            const progress = Math.round((step / totalSteps) * 100);
            const progressEvent = this.jobsStorage.appendJobEvent(
                job.id,
                `Шаг ${step}/${totalSteps} (${progress}%)`,
                "info",
            );
            this.emitJobEvent(progressEvent);
        }

        return "Задача успешно завершена";
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
        const isAbort =
            error instanceof DOMException && error.name === "AbortError";
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
