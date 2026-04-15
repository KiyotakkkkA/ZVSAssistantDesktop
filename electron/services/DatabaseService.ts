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
                owner_id TEXT NOT NULL DEFAULT '' REFERENCES profiles(id) ON DELETE CASCADE,
                name TEXT,
                is_for_project INTEGER NOT NULL,
                ui_messages TEXT NOT NULL,
                context_messages TEXT NOT NULL,
                token_usage TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                is_completed INTEGER NOT NULL DEFAULT 0,
                is_pending INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                error_message TEXT,
                created_by TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS jobs_events (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                tag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS storage_folders (
                id TEXT PRIMARY KEY,
                vecstore_id TEXT REFERENCES storage_vecstores(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                size REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS storage_files (
                id TEXT PRIMARY KEY,
                folder_id TEXT NOT NULL REFERENCES storage_folders(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                size REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS storage_vecstores (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                folder_id TEXT NOT NULL REFERENCES storage_folders(id) ON DELETE CASCADE,
                description TEXT NOT NULL DEFAULT '',
                path TEXT NOT NULL,
                size REAL NOT NULL,
                entities_count INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            
            CREATE TABLE IF NOT EXISTS secrets (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                secret TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `);
    }
}
