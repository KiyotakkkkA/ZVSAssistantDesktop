import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "./DatabaseService";
import { FSystemService } from "../FSystemService";
import type {
    SavedFileRecord,
    UploadedFileData,
} from "../../../src/types/ElectronApi";

export class FileStorageService {
    constructor(
        private readonly filesPath: string,
        private readonly databaseService: DatabaseService,
        private readonly fSystemService: FSystemService,
        private readonly createdBy: string,
    ) {}

    saveFiles(files: UploadedFileData[]): SavedFileRecord[] {
        const saved: SavedFileRecord[] = [];

        for (const file of files) {
            const fileId = randomUUID().replace(/-/g, "");
            const fileExt = path.extname(file.name || "");
            const encryptedName = `${fileId}${fileExt}`;
            const absolutePath = path.join(this.filesPath, encryptedName);
            const buffer = this.parseDataUrl(file.dataUrl);

            this.fSystemService.writeFileBufferSync(absolutePath, buffer);

            const entry = {
                path: absolutePath,
                originalName: file.name,
                size: Number.isFinite(file.size)
                    ? file.size
                    : buffer.byteLength,
                savedAt: new Date().toISOString(),
            };

            this.databaseService.upsertFile(fileId, entry, this.createdBy);

            saved.push({
                id: fileId,
                ...entry,
            });
        }

        return saved;
    }

    getFilesByIds(fileIds: string[]): SavedFileRecord[] {
        return this.databaseService.getFilesByIds(fileIds, this.createdBy);
    }

    getAllFiles(): SavedFileRecord[] {
        return this.databaseService.getAllFiles(this.createdBy);
    }

    getFileById(fileId: string): SavedFileRecord | null {
        return this.databaseService.getFileById(fileId, this.createdBy);
    }

    deleteFileById(fileId: string): boolean {
        if (!fileId) {
            return false;
        }

        const file = this.databaseService.getFileById(fileId, this.createdBy);

        if (!file) {
            return false;
        }

        this.fSystemService.deleteFileIfExistsSync(file.path);

        this.databaseService.deleteFilesByIds([fileId], this.createdBy);
        return true;
    }

    deleteFilesByIds(fileIds: string[]): void {
        if (!fileIds.length) {
            return;
        }

        const files = this.databaseService.getFilesByIds(
            fileIds,
            this.createdBy,
        );

        for (const entry of files) {
            this.fSystemService.deleteFileIfExistsSync(entry.path);
        }

        this.databaseService.deleteFilesByIds(fileIds, this.createdBy);
    }

    private parseDataUrl(dataUrl: string): Buffer {
        if (typeof dataUrl !== "string") {
            return Buffer.from("");
        }

        const marker = ";base64,";
        const markerIndex = dataUrl.indexOf(marker);

        if (markerIndex === -1) {
            return Buffer.from(dataUrl);
        }

        const base64 = dataUrl.slice(markerIndex + marker.length);
        return Buffer.from(base64, "base64");
    }
}
