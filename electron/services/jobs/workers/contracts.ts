import type {
    CreateJobPayload,
    JobEventTag,
    JobKind,
    JobRecord,
} from "../../../models/job";

export type JobWorkerContext = {
    job: JobRecord;
    payload: CreateJobPayload;
    signal: AbortSignal;
    emitStage: (message: string, tag?: JobEventTag) => void;
    delay: (ms: number) => Promise<void>;
};

export interface JobWorker {
    kind: JobKind;
    run(context: JobWorkerContext): Promise<string>;
}
