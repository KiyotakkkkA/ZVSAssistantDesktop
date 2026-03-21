import type { DatabaseService } from "../services/DatabaseService";
import type {
    CreateDialogDto,
    DialogContextMessage,
    DialogEntity,
    DialogId,
    DialogUiMessage,
    UpdateDialogStateDto,
} from "../models/dialog";

interface RawDialogData {
    id: string;
    name: string;
    is_for_project: number;
    ui_messages: string;
    context_messages: string;
    token_usage: string;
}

const mapDialog = (raw: RawDialogData): DialogEntity => ({
    id: raw.id as DialogId,
    name: raw.name,
    is_for_project: raw.is_for_project === 1,
    ui_messages: JSON.parse(raw.ui_messages) as DialogUiMessage[],
    context_messages: JSON.parse(
        raw.context_messages,
    ) as DialogContextMessage[],
    token_usage: JSON.parse(raw.token_usage) as unknown,
});

export class DialogRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    findAll() {
        const rows = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM dialogs ORDER BY rowid ASC")
            .all() as RawDialogData[];

        return rows.map(mapDialog);
    }

    createDialog(dialog: CreateDialogDto) {
        this.databaseService
            .getDatabase()
            .prepare(
                `
                INSERT INTO dialogs (id, name, is_for_project, ui_messages, context_messages, token_usage)
                VALUES (@id, @name, @is_for_project, @ui_messages, @context_messages, @token_usage)
            `,
            )
            .run({
                id: dialog.id,
                name: dialog.name,
                is_for_project: dialog.is_for_project ? 1 : 0,
                ui_messages: "[]",
                context_messages: "[]",
                token_usage: "null",
            });

        return this.findById(dialog.id);
    }

    findById(id: DialogId) {
        const raw = this.databaseService
            .getDatabase()
            .prepare("SELECT * FROM dialogs WHERE id = ?")
            .get(id) as RawDialogData | undefined;

        if (!raw) {
            return null;
        }

        return mapDialog(raw);
    }

    updateName(id: DialogId, name: string) {
        this.databaseService
            .getDatabase()
            .prepare("UPDATE dialogs SET name = @name WHERE id = @id")
            .run({ id, name });
    }

    updateDialogState(id: DialogId, payload: UpdateDialogStateDto) {
        this.databaseService
            .getDatabase()
            .prepare(
                `
                UPDATE dialogs
                SET ui_messages = @ui_messages, context_messages = @context_messages, token_usage = @token_usage
                WHERE id = @id
            `,
            )
            .run({
                id,
                ui_messages: JSON.stringify(payload.ui_messages),
                context_messages: JSON.stringify(payload.context_messages),
                token_usage: JSON.stringify(payload.token_usage),
            });
    }

    deleteDialog(id: DialogId) {
        this.databaseService
            .getDatabase()
            .prepare("DELETE FROM dialogs WHERE id = ?")
            .run(id);
    }
}
