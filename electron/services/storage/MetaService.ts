import fs from "node:fs";
import type { MetaPayload } from "../../../src/types/UserData";
import { attemptSyncOr } from "../../errors/errorPattern";

const defaultMeta: MetaPayload = {
    currentUserId: "",
};

export class MetaService {
    constructor(private readonly metaPath: string) {}

    getCurrentUserId(): string | null {
        const parsed = this.readMeta();
        const userId =
            typeof parsed.currentUserId === "string"
                ? parsed.currentUserId.trim()
                : "";

        return userId || null;
    }

    setCurrentUserId(userId: string): void {
        const normalizedUserId =
            typeof userId === "string" ? userId.trim() : "";

        fs.writeFileSync(
            this.metaPath,
            JSON.stringify(
                {
                    currentUserId: normalizedUserId,
                } satisfies MetaPayload,
                null,
                2,
            ),
        );
    }

    private readMeta(): MetaPayload {
        if (!fs.existsSync(this.metaPath)) {
            return defaultMeta;
        }

        return attemptSyncOr(() => {
            const raw = fs.readFileSync(this.metaPath, "utf-8");
            const parsed = JSON.parse(raw) as Partial<MetaPayload>;

            return {
                currentUserId:
                    typeof parsed.currentUserId === "string"
                        ? parsed.currentUserId
                        : "",
            };
        }, defaultMeta);
    }
}
