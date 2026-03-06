import { Icon } from "@iconify/react";
import { useState } from "react";
import { useFileUpload } from "../../../hooks";
import { Button } from "zvs-uikit-lib";

type InputPathProps = {
    label?: string;
    helperText?: string;
    value?: string;
    onChange?: (path: string) => void;
    placeholder?: string;
    forFolders?: boolean;
    className?: string;
};

export function InputPath({
    label = "Путь",
    helperText,
    value,
    onChange,
    placeholder = "Путь не выбран",
    forFolders = false,
    className = "",
}: InputPathProps) {
    const [internalPath, setInternalPath] = useState("");
    const selectedPath = value ?? internalPath;
    const { isPickingPath, pickPath } = useFileUpload();

    const handlePickPath = async () => {
        const selected = await pickPath({ forFolders });

        if (!selected) {
            return;
        }

        if (value === undefined) {
            setInternalPath(selected);
        }

        onChange?.(selected);
    };

    const clearPath = () => {
        if (value === undefined) {
            setInternalPath("");
        }

        onChange?.("");
    };

    return (
        <div className={`space-y-3 ${className}`}>
            <div>
                <p className="text-sm font-semibold text-main-100">{label}</p>
                <p className="mt-1 text-xs text-main-400">
                    {helperText ||
                        (forFolders
                            ? "Выберите директорию проекта"
                            : "Выберите путь")}
                </p>
            </div>

            <div className="rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={handlePickPath}
                        disabled={isPickingPath}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Icon
                                icon="mdi:folder-search-outline"
                                width="16"
                                height="16"
                            />
                            {isPickingPath
                                ? "Открывается проводник..."
                                : forFolders
                                  ? "Выбрать директорию"
                                  : "Выбрать путь"}
                        </span>
                    </Button>

                    {selectedPath ? (
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={clearPath}
                        >
                            Очистить
                        </Button>
                    ) : null}
                </div>

                <div className="mt-3 rounded-lg border border-main-700/70 bg-main-800/60 px-3 py-2 text-sm text-main-200">
                    <div className="flex items-center gap-2">
                        <Icon
                            icon="mdi:folder-outline"
                            width="16"
                            height="16"
                            className="text-main-400"
                        />
                        <span
                            className="truncate"
                            title={selectedPath || placeholder}
                        >
                            {selectedPath || placeholder}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
