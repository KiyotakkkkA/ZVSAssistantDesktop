import { Icon } from "@iconify/react";
import { Alert, Button, InputSmall } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import { useMemo, useState } from "react";
import { storageStore } from "../../../../../stores/storageStore";

type VecstoresPickFormProps = {
    selectedVecstoreId: string | null;
    onSelectVecstore: (vecstoreId: string | null) => void;
};

export const VecstoresPickForm = observer(
    ({ selectedVecstoreId, onSelectVecstore }: VecstoresPickFormProps) => {
        const [query, setQuery] = useState("");

        const normalizedQuery = query.trim().toLowerCase();

        const vecstores = useMemo(() => {
            const items = storageStore.linkedVecstores;

            if (!normalizedQuery) {
                return items;
            }

            return items.filter((vecstore) => {
                return (
                    vecstore.name.toLowerCase().includes(normalizedQuery) ||
                    vecstore.description.toLowerCase().includes(normalizedQuery)
                );
            });
        }, [normalizedQuery]);

        return (
            <div className="space-y-3">
                <Alert variant="info">
                    <p className="text-sm font-semibold text-main-100">
                        Хранилище для ответа
                    </p>
                    <p className="mt-1 text-xs text-main-400">
                        Выберите векторное хранилище для подмешивания контекста
                        в ответ.
                    </p>
                </Alert>

                <InputSmall
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Поиск хранилища"
                />

                <div className="max-h-96 space-y-2 overflow-y-auto bg-main-900/35">
                    {vecstores.length > 0 ? (
                        vecstores.map((vecstore) => {
                            const isSelected =
                                selectedVecstoreId === vecstore.id;

                            return (
                                <Button
                                    key={vecstore.id}
                                    type="button"
                                    variant=""
                                    shape="rounded-lg"
                                    className={`h-auto w-full justify-start px-3 py-2 text-left border-transparent ${
                                        isSelected
                                            ? "bg-main-700/70 text-main-50"
                                            : "bg-main-900/35 text-main-200 hover:bg-main-700/40"
                                    }`}
                                    onClick={() =>
                                        onSelectVecstore(vecstore.id)
                                    }
                                >
                                    <div className="w-full min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-medium">
                                                {vecstore.name}
                                            </p>
                                            {isSelected ? (
                                                <Icon
                                                    icon="mdi:check-circle"
                                                    width={16}
                                                    height={16}
                                                />
                                            ) : null}
                                        </div>
                                        <p className="mt-1 truncate text-xs text-main-400">
                                            {vecstore.description ||
                                                "Без описания"}
                                        </p>
                                    </div>
                                </Button>
                            );
                        })
                    ) : (
                        <div className="px-2 py-6 text-center text-sm text-main-400">
                            Хранилища не найдены
                        </div>
                    )}
                </div>
            </div>
        );
    },
);
