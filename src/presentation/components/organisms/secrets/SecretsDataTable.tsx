import { Table, type TableSchemaItem } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { observer } from "mobx-react-lite";
import type { SecretEntity } from "../../../../stores/secretsStore";
import { secretsStore } from "../../../../stores/secretsStore";
import { MsgToasts } from "../../../../data/MsgToasts";
import { ButtonDelete } from "../../atoms";

type SecretRow = SecretEntity & {
    row_index: number;
    actions?: string;
    [key: string]: string | number | undefined;
};

const schema: TableSchemaItem<SecretRow>[] = [
    {
        key: "row_index",
        label: "№",
    },
    { key: "type", label: "Тип" },
    { key: "name", label: "Название" },
    { key: "secret", label: "Секрет" },
    { key: "actions", label: "", align: "right" },
];

const compareColumn = (
    left: SecretRow,
    right: SecretRow,
    key: Extract<keyof SecretRow, string>,
) => {
    if (key === "actions") {
        return 0;
    }

    if (key === "row_index") {
        return Number(left[key]) - Number(right[key]);
    }

    return String(left[key]).localeCompare(String(right[key]), "ru");
};

const maskSecret = (value: string) => {
    if (value.length <= 8) {
        return "*".repeat(Math.max(value.length, 8));
    }

    return `${value.slice(0, 3)}${"*".repeat(Math.max(value.length - 5, 6))}${value.slice(-2)}`;
};

export const SecretsDataTable = observer(() => {
    const toast = useToasts();

    const rows: SecretRow[] = secretsStore.secrets.map((item, index) => ({
        ...item,
        row_index: index + 1,
    }));

    const handleDeleteSecret = async (secretId: string) => {
        await secretsStore.removeSecret(secretId);
        toast.success(MsgToasts.SECRET_SUCCESSFULLY_REMOVED());
    };

    return (
        <>
            <Table
                data={rows}
                schema={schema}
                rowKey={(row) => String(row.id)}
                className="animate-panel-slide-in"
                hoverable
            >
                <Table.Header<SecretRow>
                    defaultSortColumn="row_index"
                    defaultSortMode="asc"
                    classNames={{
                        sortButton: "text-sm",
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
                                    {maskSecret(context.row?.secret ?? "")}
                                </code>
                            )}
                        </Table.Column>
                        <Table.Column<SecretRow> field="actions" align="right">
                            {(context) => (
                                <div>
                                    <ButtonDelete
                                        size={22}
                                        className="p-1"
                                        confirm
                                        labelModal={`Вы действительно хотите удалить секрет '${context.row?.name ?? "секрет"}'?`}
                                        deleteFn={() => {
                                            const secretId = context.row?.id;

                                            if (!secretId) {
                                                return;
                                            }

                                            void handleDeleteSecret(secretId);
                                        }}
                                    />
                                </div>
                            )}
                        </Table.Column>
                    </Table.Row>
                </Table.Body>
            </Table>
        </>
    );
});
