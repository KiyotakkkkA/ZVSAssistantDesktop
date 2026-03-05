import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { useFileUpload } from "../../../hooks";
import type { UploadedFileData } from "../../../types/ElectronApi";
import { Button } from "./Button";

type InputFileProps = {
    label?: string;
    helperText?: string;
    value?: UploadedFileData[];
    onChange?: (files: UploadedFileData[]) => void;
    accept?: string[];
    multiple?: boolean;
    className?: string;
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb = bytes / 1024;

    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
};

const resolveNotImageTypeIcon = (filename: string) => {
    const extIcons = {
        pdf: "mdi:file-pdf",
        doc: "mdi:file-word",
        docx: "mdi:file-word",
        xls: "mdi:file-excel",
        xlsx: "mdi:file-excel",
        ppt: "mdi:file-powerpoint",
        pptx: "mdi:file-powerpoint",
    };

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";

    return extIcons[ext as keyof typeof extIcons] || "mdi:file-outline";
};

export function InputFile({
    label = "Документы",
    helperText,
    value,
    onChange,
    accept,
    multiple = true,
    className = "",
}: InputFileProps) {
    const [internalFiles, setInternalFiles] = useState<UploadedFileData[]>([]);
    const files = value ?? internalFiles;
    const { isUploading, pickFiles } = useFileUpload();

    const acceptLabel = useMemo(() => {
        if (!accept || accept.length === 0) {
            return "Любые файлы";
        }

        return accept.join(", ");
    }, [accept]);

    const handlePickFiles = async () => {
        const selected = await pickFiles({
            accept,
            multiple,
        });

        if (!selected.length) {
            return;
        }

        const nextFiles = multiple ? [...files, ...selected] : [selected[0]];

        if (!value) {
            setInternalFiles(nextFiles);
        }

        onChange?.(nextFiles);
    };

    const removeFile = (fileToRemove: UploadedFileData) => {
        const nextFiles = files.filter(
            (file) =>
                !(
                    file.name === fileToRemove.name &&
                    file.size === fileToRemove.size &&
                    file.dataUrl === fileToRemove.dataUrl
                ),
        );

        if (!value) {
            setInternalFiles(nextFiles);
        }

        onChange?.(nextFiles);
    };

    return (
        <div className={`space-y-3 ${className}`}>
            <div>
                <p className="text-sm font-semibold text-main-100">{label}</p>
                <p className="mt-1 text-xs text-main-400">
                    {helperText || `Поддерживаемые типы: ${acceptLabel}`}
                </p>
            </div>

            <div className="rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    onClick={handlePickFiles}
                    disabled={isUploading}
                >
                    <span className="inline-flex items-center gap-2">
                        <Icon icon="mdi:paperclip" width="16" height="16" />
                        {isUploading
                            ? "Открывается проводник..."
                            : "Прикрепить файл"}
                    </span>
                </Button>

                {files.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                        {files.map((file) => {
                            const isImage = file.mimeType.startsWith("image/");

                            return (
                                <div
                                    key={`${file.name}-${file.size}-${file.dataUrl}`}
                                    className="flex items-center gap-3 rounded-lg border border-main-700/70 bg-main-800/60 p-2"
                                >
                                    <div className="h-10 w-10 overflow-hidden rounded-md bg-main-700/60">
                                        {isImage ? (
                                            <img
                                                src={file.dataUrl}
                                                alt={file.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-main-300">
                                                <Icon
                                                    icon={resolveNotImageTypeIcon(
                                                        file.name,
                                                    )}
                                                    width="20"
                                                    height="20"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-main-100">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-main-400">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        shape="rounded-full"
                                        className="h-7 w-7 p-0"
                                        onClick={() => removeFile(file)}
                                        label={`Удалить ${file.name}`}
                                    >
                                        <Icon
                                            icon="mdi:close"
                                            width="14"
                                            height="14"
                                        />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
