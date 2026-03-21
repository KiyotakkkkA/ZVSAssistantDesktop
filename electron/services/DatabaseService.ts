import Database from "better-sqlite3";

export class DatabaseService {
    private readonly database: Database.Database;

    constructor(private readonly databasePath: string) {
        this.database = new Database(this.databasePath);
        this.database.pragma("journal_mode = WAL");
        this.database.pragma("foreign_keys = ON");
        this.initializeSchema();
    }

    getDatabase() {
        return this.database;
    }

    private initializeSchema(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                is_current INTEGER NOT NULL,
                general_data TEXT NOT NULL,
                secure_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dialogs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_for_project INTEGER NOT NULL,
                ui_messages TEXT NOT NULL,
                context_messages TEXT NOT NULL,
                token_usage TEXT NOT NULL
            );
        `);
    }
}
