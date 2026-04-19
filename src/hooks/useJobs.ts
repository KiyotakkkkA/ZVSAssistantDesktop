import { useCallback, useEffect } from "react";
import { useObserver } from "mobx-react-lite";
import type { CreateJobPayload } from "../types/ElectronApi";
import { jobsStorage } from "../stores/jobsStorage";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../data/MsgToasts";

export const useJobs = () => {
    const toast = useToasts();

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
                toast.danger(MsgToasts.JOB_CREATION_ERROR(payload.name));
                return null;
            }

            toast.success(MsgToasts.JOB_SUCCESSFULLY_CREATED(createdJob.name));

            return {
                job: createdJob,
                cancelJob: () => jobsStorage.cancelJob(createdJob.id),
            };
        },
        [toast],
    );

    const cancelJobById = useCallback(
        async (jobId: string) => {
            const isCancelled = await jobsStorage.cancelJob(jobId);

            if (!isCancelled) {
                toast.danger(
                    MsgToasts.JOB_CANCELLING_ERROR(
                        jobsStorage.getJobById(jobId)?.name || "UNKNOWN",
                    ),
                );
                return false;
            }

            toast.success(
                MsgToasts.JOB_SUCCESSFULLY_STOPPED(
                    jobsStorage.getJobById(jobId)?.name || "UNKNOWN",
                ),
            );

            return true;
        },
        [toast],
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
