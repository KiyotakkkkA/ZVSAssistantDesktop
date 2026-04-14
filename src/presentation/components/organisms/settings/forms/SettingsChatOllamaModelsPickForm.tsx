import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import {
    Button,
    InputSmall,
    Loader,
    Select,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import {
    getOllamaModelsCatalog,
    type OllamaCatalogModel,
} from "../../../../../services/api";
import { SettingsChatOllamaModelPickCard } from "../../../molecules/settings";

type SortKey =
    | "modified_desc"
    | "modified_asc"
    | "size_desc"
    | "size_asc"
    | "name_asc"
    | "name_desc";

type SettingsChatOllamaModelsPickFormProps = {
    baseUrl: string;
    currentModel: string;
    onSelectModel: (modelName: string) => void;
    onClose: () => void;
};

const normalize = (value: string | null | undefined): string =>
    value?.trim().toLocaleLowerCase() || "";

const nonEmptyValue = (value: string | null | undefined): string => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : "—";
};

export function SettingsChatOllamaModelsPickForm({
    baseUrl,
    currentModel,
    onSelectModel,
    onClose,
}: SettingsChatOllamaModelsPickFormProps) {
    const [models, setModels] = useState<OllamaCatalogModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("modified_desc");

    useEffect(() => {
        let isCancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError("");

            if (!baseUrl) {
                setIsLoading(false);
                setError("Укажите Base URL провайдера");
                return;
            }

            try {
                const fetchedModels = await getOllamaModelsCatalog(baseUrl);

                if (!isCancelled) {
                    setModels(fetchedModels);
                }
            } catch (err) {
                if (isCancelled) {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Не удалось загрузить список моделей",
                );
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            isCancelled = true;
        };
    }, [baseUrl]);

    const filteredModels = useMemo(() => {
        const normalizedQuery = normalize(query);

        const filtered = models.filter((item) => {
            if (normalizedQuery) {
                const searchInput = [
                    item.name,
                    item.model,
                    item.digest,
                    item.details.family,
                    item.details.parameter_size,
                    item.details.quantization_level,
                ]
                    .map((value) => normalize(value))
                    .join(" ");

                if (!searchInput.includes(normalizedQuery)) {
                    return false;
                }
            }

            return true;
        });

        return [...filtered].sort((left, right) => {
            switch (sortKey) {
                case "modified_asc":
                    return (
                        new Date(left.modified_at).getTime() -
                        new Date(right.modified_at).getTime()
                    );
                case "size_desc":
                    return right.size - left.size;
                case "size_asc":
                    return left.size - right.size;
                case "name_asc":
                    return left.name.localeCompare(right.name);
                case "name_desc":
                    return right.name.localeCompare(left.name);
                case "modified_desc":
                default:
                    return (
                        new Date(right.modified_at).getTime() -
                        new Date(left.modified_at).getTime()
                    );
            }
        });
    }, [models, query, sortKey]);

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-main-700/80 bg-main-900/45 p-3">
                <div className="flex items-center justify-between">
                    <InputSmall
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск по названию, digest, family"
                        className="h-10"
                    />

                    <Select
                        value={sortKey}
                        onChange={(value) => setSortKey(value as SortKey)}
                        options={[
                            { value: "modified_desc", label: "Сначала новые" },
                            { value: "modified_asc", label: "Сначала старые" },
                            { value: "size_desc", label: "Размер ↓" },
                            { value: "size_asc", label: "Размер ↑" },
                            { value: "name_asc", label: "Имя A → Z" },
                            { value: "name_desc", label: "Имя Z → A" },
                        ]}
                        classNames={{
                            menu: "border border-main-700/70 shadow-lg bg-main-900/92 backdrop-blur-md",
                            trigger: "bg-main-700/45",
                        }}
                    />
                </div>

                <p className="mt-3 text-xs text-main-400">
                    Найдено: {filteredModels.length} / {models.length}
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-main-700/80 bg-main-900/45 py-14">
                    <Loader />
                </div>
            ) : error ? (
                <div className="rounded-xl border border-main-700/80 bg-main-900/45 p-4 text-sm text-red-300">
                    {error}
                </div>
            ) : filteredModels.length === 0 ? (
                <div className="rounded-xl border border-main-700/80 bg-main-900/45 p-4 text-sm text-main-400">
                    Модели не найдены для текущих фильтров.
                </div>
            ) : (
                <div className="grid gap-3 grid-cols-3">
                    {filteredModels.map((item) => (
                        <SettingsChatOllamaModelPickCard
                            key={`${item.model}_${item.digest}`}
                            model={item}
                            selected={item.name === currentModel}
                            baseUrl={baseUrl}
                            onPick={(modelName) => {
                                onSelectModel(modelName);
                                onClose();
                            }}
                        />
                    ))}
                </div>
            )}

            <div className="flex justify-between gap-2 border-t border-main-700/80 pt-3">
                <p className="flex items-center gap-2 text-xs text-main-400">
                    <Icon
                        icon="mdi:information-outline"
                        width={16}
                        height={16}
                    />
                    Текущая модель: {nonEmptyValue(currentModel)}
                </p>
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    onClick={onClose}
                >
                    Закрыть
                </Button>
            </div>
        </div>
    );
}
