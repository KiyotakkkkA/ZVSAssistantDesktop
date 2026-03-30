import type { JobWorker } from "./contracts";

const normalizeStepCount = (value: number) => {
    return Math.min(100, Math.max(1, Math.floor(value)));
};

const normalizeStepDelayMs = (value: number) => {
    return Math.min(30_000, Math.max(200, Math.floor(value)));
};

export class TestTaskWorker implements JobWorker {
    readonly kind = "test-task" as const;

    async run({ payload, emitStage, delay }: Parameters<JobWorker["run"]>[0]) {
        const totalSteps = normalizeStepCount(payload.totalSteps ?? 10);
        const stepDelayMs = normalizeStepDelayMs(payload.stepDelayMs ?? 1000);

        emitStage("Тестовая задача запущена", "info");

        for (let step = 1; step <= totalSteps; step += 1) {
            await delay(stepDelayMs);
            const progress = Math.round((step / totalSteps) * 100);
            emitStage(`Шаг ${step}/${totalSteps} (${progress}%)`, "info");
        }

        return "Тестовая задача успешно завершена";
    }
}
