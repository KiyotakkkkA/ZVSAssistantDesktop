import type { CreateSecretDto, SecretEntity } from "../models/secret";
import type { DatabaseService } from "../services/DatabaseService";

type RawSecretData = {
    id: string;
    type: string;
    name: string;
    secret: string;
    created_at: string;
    updated_at: string;
};

const mapSecret = (row: RawSecretData): SecretEntity => ({
    id: row.id,
    type: row.type,
    name: row.name,
    secret: row.secret,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export class SecretsRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll(): SecretEntity[] {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM secrets ORDER BY updated_at DESC")
            .all() as RawSecretData[];

        return rows.map(mapSecret);
    }

    findByType(type: string): SecretEntity[] {
        const normalizedType = type.trim().toLowerCase();

        if (!normalizedType) {
            return [];
        }

        const rows = this.databaseService
            .getDatabase()
            .prepare(
                `
                SELECT *
                FROM secrets
                WHERE LOWER(type) = ?
                ORDER BY updated_at DESC
                `,
            )
            .all(normalizedType) as RawSecretData[];

        return rows.map(mapSecret);
    }

    createSecret(payload: CreateSecretDto): SecretEntity {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();

        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO secrets (id, type, name, secret, created_at, updated_at)
                VALUES (@id, @type, @name, @secret, @created_at, @updated_at)
                `,
            )
            .run({
                id,
                type: payload.type.trim(),
                name: payload.name.trim(),
                secret: payload.secret.trim(),
                created_at: now,
                updated_at: now,
            });

        const created = this.findById(id);

        if (!created) {
            throw new Error("Failed to create secret");
        }

        return created;
    }

    deleteSecret(id: string): void {
        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM secrets WHERE id = ?")
            .run(id);
    }

    private findById(id: string): SecretEntity | null {
        const row = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM secrets WHERE id = ? LIMIT 1")
            .get(id) as RawSecretData | undefined;

        if (!row) {
            return null;
        }

        return mapSecret(row);
    }
}
