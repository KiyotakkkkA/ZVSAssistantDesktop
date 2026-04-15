import { Table, type TableSchemaItem } from "@kiyotakkkka/zvs-uikit-lib/ui";

type Secret = {
    id: string;
    type: string;
    name: string;
    secret: string;
};

type SecretRow = Secret & {
    row_index: number;
    actions?: React.ReactNode;
};

const schema: TableSchemaItem<SecretRow>[] = [
    {
        key: "row_index",
        label: "№",
        align: "center",
        width: 56,
    },
    { key: "type", label: "Тип", width: 160 },
    { key: "name", label: "Название" },
    { key: "secret", label: "Секрет", width: 220 },
    { key: "actions", label: "Действия", width: 180 },
];

const data: Secret[] = [
    {
        id: "1",
        type: "API Key",
        name: "OpenAI API Key",
        secret: "sk-***************",
    },
    {
        id: "2",
        type: "Password",
        name: "Database Password",
        secret: "********",
    },
];

const rows: SecretRow[] = data.map((item, index) => ({
    ...item,
    row_index: index + 1,
}));

export const SecretsDataTable = () => {
    const compareColumn = (
        left: SecretRow,
        right: SecretRow,
        key: Extract<keyof SecretRow, string>,
    ) => {
        if (key === "row_index") {
            return Number(left[key]) - Number(right[key]);
        }

        return String(left[key]).localeCompare(String(right[key]), "ru");
    };

    return (
        <Table
            data={rows}
            schema={schema}
            rowKey={(row) => row.id}
            className="overflow-hidden rounded-2xl border border-main-700/70 bg-main-900/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] animate-panel-slide-in"
            classNames={{
                table: "w-full text-sm",
                header: "text-main-300",
                body: "text-main-100",
                row: "border-b border-main-700/55 last:border-b-0",
                cell: "px-3 py-2.5 align-middle",
                sortButton: "transition-colors hover:text-main-100",
            }}
            striped
            hoverable
        >
            <Table.Header<SecretRow>
                defaultSortColumn="row_index"
                defaultSortMode="asc"
                classNames={{
                    root: "bg-main-800/70",
                    row: "border-b border-main-700/70",
                    cell: "px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-main-300",
                    sortButton:
                        "inline-flex items-center gap-1 transition-colors hover:text-main-100",
                }}
                sortModes={{
                    asc: {
                        sortIcon: "↑",
                        sortFn: (a, b, key) => compareColumn(a, b, key),
                    },
                    desc: {
                        sortIcon: "↓",
                        sortFn: (a, b, key) => compareColumn(b, a, key),
                    },
                }}
            />

            <Table.Body
                classNames={{
                    root: "bg-main-900/35",
                    row: "transition-colors hover:bg-main-800/65",
                    empty: "py-8 text-center text-sm text-main-400",
                }}
                emptyState="Секреты пока не добавлены"
            >
                <Table.Row<SecretRow> className="animate-card-rise-in">
                    <Table.Column<SecretRow> field="row_index">
                        {(context) => context.row?.row_index}
                    </Table.Column>
                    <Table.Column<SecretRow> field="type">
                        {(context) => (
                            <span className="inline-flex rounded-md border border-main-600/70 bg-main-800/80 px-2 py-0.5 text-[11px] text-main-200">
                                {context.row?.type}
                            </span>
                        )}
                    </Table.Column>
                    <Table.Column<SecretRow> field="name">
                        {(context) => (
                            <div className="min-w-0">
                                <p className="truncate text-sm text-main-100">
                                    {context.row?.name}
                                </p>
                            </div>
                        )}
                    </Table.Column>
                    <Table.Column<SecretRow> field="secret">
                        {(context) => (
                            <code className="rounded-md bg-main-800/90 px-2 py-1 text-xs text-main-200">
                                {context.row?.secret}
                            </code>
                        )}
                    </Table.Column>
                    <Table.Column>
                        {(_) => (
                            <div className="flex gap-4">
                                <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-main-600/70 bg-main-800/80 px-2 py-0.5 text-[11px] text-main-200 hover:bg-main-700/90">
                                    Редактировать
                                </span>
                                <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-600/70 bg-red-800/80 px-2 py-0.5 text-[11px] text-red-200 hover:bg-red-700/90">
                                    Удалить
                                </span>
                            </div>
                        )}
                    </Table.Column>
                </Table.Row>
            </Table.Body>
        </Table>
    );
};
