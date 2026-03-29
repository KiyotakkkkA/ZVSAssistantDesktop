import { useCallback, useEffect } from "react";
import { useObserver } from "mobx-react-lite";
import type { CreateJobPayload } from "../types/ElectronApi";
import { jobsStorage } from "../stores/jobsStorage";
import { useToasts } from "./useToasts";

export const useJobs = () => {
    const toasts = useToasts();

    useEffect(() => {
        void jobsStorage.initialize();

        return () => {
            jobsStorage.dispose();
        };
    }, []);

    const createJob = useCallback(
        async (payload: CreateJobPayload) => {
            const createdJob = await jobsStorage.createJob(payload);

            if (!createdJob) {
                toasts.warning({
                    title: "Не удалось создать задачу",
                    description: "Попробуйте еще раз.",
                });
                return null;
            }

            toasts.success({
                title: "Фоновая задача создана",
                description: `Задача ${createdJob.name} запущена.`,
            });

            return {
                job: createdJob,
                cancelJob: () => jobsStorage.cancelJob(createdJob.id),
            };
        },
        [toasts],
    );

    const cancelJobById = useCallback(
        async (jobId: string) => {
            const isCancelled = await jobsStorage.cancelJob(jobId);

            if (!isCancelled) {
                toasts.warning({
                    title: "Не удалось отменить задачу",
                    description: "Возможно, задача уже завершилась.",
                });
                return false;
            }

            toasts.info({
                title: "Задача отменена",
                description: "Выполнение остановлено.",
            });

            return true;
        },
        [toasts],
    );

    const refreshJobs = useCallback(async () => {
        await jobsStorage.refreshJobs();

        if (jobsStorage.selectedJobId) {
            await jobsStorage.loadJobEvents(jobsStorage.selectedJobId);
        }
    }, []);

    const selectJob = useCallback((jobId: string) => {
        jobsStorage.setSelectedJobId(jobId);
        void jobsStorage.loadJobEvents(jobId);
    }, []);

    return useObserver(() => ({
        isLoading: jobsStorage.isLoading,
        jobs: jobsStorage.jobs,
        selectedJobId: jobsStorage.selectedJobId,
        selectedJob: jobsStorage.selectedJob,
        selectedJobEvents: jobsStorage.selectedJobEvents,
        getJobById: jobsStorage.getJobById,
        createJob,
        cancelJobById,
        refreshJobs,
        selectJob,
    }));
};
