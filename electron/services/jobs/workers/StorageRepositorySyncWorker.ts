import type { JobWorker } from "./contracts";
import type { AppStorageService } from "../../AppStorageService";

export class StorageRepositorySyncWorker implements JobWorker {
    readonly kind = "storage-repository-sync" as const;

    constructor(private readonly appStorageService: AppStorageService) {}

    async run({ payload, emitStage, signal }: Parameters<JobWorker["run"]>[0]) {
        const syncPayload = payload.storageRepositorySync;

        if (!syncPayload) {
            throw new Error("Параметры синхронизации репозитория не заданы");
        }

        emitStage("Запуск синхронизации репозитория", "info");

        const result = await this.appStorageService.syncRepository(
            syncPayload,
            {
                signal,
                onStage: emitStage,
            },
        );

        return [
            "Синхронизация завершена",
            `Папка: ${result.folderName}`,
            `Загружено файлов: ${result.downloadedCount}`,
            `Пропущено файлов: ${result.skippedCount}`,
        ].join("\n");
    }
}
