import { InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import type {
    CreateStorageVecstoreDto,
    StorageFolderEntity,
} from "../../../../../../electron/models/storage";

type StorageVecstoreCreateFormProps = {
    folders: StorageFolderEntity[];
    isSubmitting?: boolean;
    fixedFolderId?: string | null;
    initialFolderId?: string | null;
    formId?: string;
    onSubmit: (payload: CreateStorageVecstoreDto) => void;
};

export const StorageVecstoreCreateForm = ({
    folders,
    isSubmitting = false,
    fixedFolderId,
    initialFolderId,
    formId = "storage-vecstore-create-form",
    onSubmit,
}: StorageVecstoreCreateFormProps) => {
    const [name, setName] = useState("");
    const [folderId, setFolderId] = useState("");

    useEffect(() => {
        const nextFolderId =
            fixedFolderId ??
            initialFolderId ??
            folders.find((folder) => !folder.vecstore_id)?.id ??
            folders[0]?.id ??
            "";

        setFolderId(nextFolderId);
    }, [fixedFolderId, folders, initialFolderId]);

    const folderOptions = useMemo(
        () =>
            folders
                .filter(
                    (folder) =>
                        !folder.vecstore_id || folder.id === fixedFolderId,
                )
                .map((folder) => ({
                    value: folder.id,
                    label: folder.name,
                })),
        [fixedFolderId, folders],
    );

    const fixedFolder =
        fixedFolderId && folders.find((folder) => folder.id === fixedFolderId);
    const isSubmitDisabled =
        isSubmitting || !name.trim() || !folderId || folderOptions.length === 0;

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitDisabled) {
            return;
        }

        onSubmit({
            name: name.trim(),
            folder_id: folderId,
        });
    };

    return (
        <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
                <label className="block text-sm text-main-200">
                    Название хранилища
                </label>
                <InputSmall
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Например, docs-embeddings"
                />
            </div>

            <div className="flex justify-between items-center">
                <label className="block text-sm text-main-200">Папка</label>

                {fixedFolder ? (
                    <div className="rounded-lg border border-main-700/70 bg-main-900/45 px-3 py-2 text-sm text-main-100">
                        {fixedFolder.name}
                    </div>
                ) : (
                    <Select
                        value={folderId}
                        onChange={setFolderId}
                        options={folderOptions}
                        classNames={{
                            menu: "border border-main-700/70 shadow-lg bg-main-900/92 backdrop-blur-md",
                            trigger: "bg-main-700/45",
                        }}
                    />
                )}
            </div>

            {folderOptions.length === 0 ? (
                <p className="text-xs text-main-300">
                    Нет доступных папок для создания векторного хранилища.
                </p>
            ) : null}
        </form>
    );
};
