import { Icon } from "@iconify/react";
import { Button } from "../../../atoms";
import type { OllamaCatalogModel } from "../../../../../services/api";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Config } from "../../../../../config";

type SettingsChatOllamaModelPickCardProps = {
    model: OllamaCatalogModel;
    selected: boolean;
    onPick: (modelName: string) => void;
};

const toSizeLabel = (size: number): string => {
    if (!Number.isFinite(size) || size <= 0) {
        return "—";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

const toDateLabel = (isoDate: string): string => {
    if (!isoDate) {
        return "—";
    }

    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
        return "—";
    }

    return parsed.toLocaleDateString("ru-RU");
};

const toValue = (value: string | null | undefined): string => {
    const normalized = value?.trim();
    return normalized ? normalized : "—";
};

export function SettingsChatOllamaModelPickCard({
    model,
    selected,
    onPick,
}: SettingsChatOllamaModelPickCardProps) {
    const modelIdWithoutColon = useMemo(() => {
        return model.name.split(":")[0];
    }, [model.name]);

    return (
        <article className="rounded-xl border border-main-700/80 bg-main-900/45 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-main-100">
                        {model.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-main-400">
                        ID: {model.model}
                    </p>
                </div>

                {selected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-main-600 bg-main-700/55 px-2 py-1 text-xs text-main-200">
                        <Icon icon="mdi:check" width={14} height={14} />
                        Выбрано
                    </span>
                ) : null}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <dt className="text-main-500">Размер</dt>
                    <dd className="text-main-300">{toSizeLabel(model.size)}</dd>
                </div>
                <div>
                    <dt className="text-main-500">Обновлён</dt>
                    <dd className="text-main-300">
                        {toDateLabel(model.modified_at)}
                    </dd>
                </div>
                <div>
                    <dt className="text-main-500">Family</dt>
                    <dd className="text-main-300">
                        {toValue(model.details.family)}
                    </dd>
                </div>
                <div>
                    <dt className="text-main-500">Format</dt>
                    <dd className="text-main-300">
                        {toValue(model.details.format)}
                    </dd>
                </div>
                <div>
                    <dt className="text-main-500">Params</dt>
                    <dd className="text-main-300">
                        {toValue(model.details.parameter_size)}
                    </dd>
                </div>
                <div>
                    <dt className="text-main-500">Quantization</dt>
                    <dd className="text-main-300">
                        {toValue(model.details.quantization_level)}
                    </dd>
                </div>
            </dl>

            <p className="mt-2 truncate text-[11px] text-main-500">
                Digest: {model.digest || "—"}
            </p>

            <div className="mt-3 flex justify-between items-center">
                <Link
                    to={`${Config.OLLAMA_BASE_URL}/library/${modelIdWithoutColon}`}
                    target="_blank"
                    className="rounded-md p-2 text-white bg-indigo-700 hover:bg-indigo-800 transition-colors flex items-center gap-1 text-xs"
                >
                    <Icon icon="mdi:open-in-new" width={18} height={18} />
                    Подробнее
                </Link>
                <Button
                    variant={selected ? "secondary" : "primary"}
                    shape="rounded-lg"
                    className="h-9 px-4"
                    disabled={selected}
                    onClick={() => onPick(model.name)}
                >
                    {selected ? "Выбрано" : "Выбрать"}
                </Button>
            </div>
        </article>
    );
}
