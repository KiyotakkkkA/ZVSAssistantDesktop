import type { JobWorker } from "./contracts";
import type { AppStorageService } from "../../AppStorageService";

export class StorageVecstoreIndexingWorker implements JobWorker {
    readonly kind = "storage-vecstore-indexing" as const;

    constructor(private readonly appStorageService: AppStorageService) {}

    async run({ payload, emitStage, signal }: Parameters<JobWorker["run"]>[0]) {
        const indexingPayload = payload.storageVecstoreIndexing;

        if (!indexingPayload) {
            throw new Error(
                "Параметры индексации векторного хранилища не заданы",
            );
        }

        emitStage("Запуск индексации векторного хранилища", "info");

        const result = await this.appStorageService.indexVecstore(
            indexingPayload,
            {
                signal,
                onStage: emitStage,
            },
        );

        return [
            "Индексация завершена",
            `Обработано файлов: ${result.requestedCount}`,
            `Успешно проиндексировано: ${result.indexedCount}`,
            `Пропущено: ${result.skippedCount}`,
            `Ошибок: ${result.failedCount}`,
        ].join("\n");
    }
}
