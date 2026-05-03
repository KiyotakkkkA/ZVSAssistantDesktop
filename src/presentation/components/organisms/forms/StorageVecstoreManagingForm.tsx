import { InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useMemo, useState } from "react";
import type {
    CreateStorageVecstoreDto,
    StorageFolderEntity,
    UpdateStorageVecstoreDto,
} from "../../../../../electron/models/storage";

type StorageVecstoreManagingFormProps = {
    model: CreateStorageVecstoreDto | UpdateStorageVecstoreDto;
    folders: StorageFolderEntity[];
    isSubmitting?: boolean;
    fixedFolderId?: string | null;
    formId?: string;
    onSubmit: (
        payload: CreateStorageVecstoreDto | UpdateStorageVecstoreDto,
    ) => Promise<void>;
};

const getDefaultFolderId = (
    folders: StorageFolderEntity[],
    fixedFolderId?: string | null,
) => {
    return (
        fixedFolderId ??
        folders.find((folder) => !folder.vecstore_id)?.id ??
        folders[0]?.id ??
        ""
    );
};

export const StorageVecstoreManagingForm = ({
    model,
    folders,
    isSubmitting = false,
    fixedFolderId,
    formId = "storage-vecstore-manage-form",
    onSubmit,
}: StorageVecstoreManagingFormProps) => {
    const isUpdateMode = "id" in model;
    const [name, setName] = useState(model.name);
    const [description, setDescription] = useState(model.description ?? "");
    const [folderId, setFolderId] = useState(() => {
        return "folder_id" in model
            ? model.folder_id
            : getDefaultFolderId(folders, fixedFolderId);
    });

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

    const fixedFolder = fixedFolderId
        ? (folders.find((folder) => folder.id === fixedFolderId) ?? null)
        : null;
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const isSubmitDisabled =
        isSubmitting ||
        !normalizedName ||
        (!isUpdateMode && (!folderId || folderOptions.length === 0));

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitDisabled) {
            return;
        }

        await onSubmit(
            isUpdateMode
                ? {
                      id: model.id,
                      name: normalizedName,
                      description: normalizedDescription || undefined,
                  }
                : {
                      name: normalizedName,
                      folder_id: fixedFolderId ?? folderId,
                      description: normalizedDescription || undefined,
                  },
        );
    };

    return (
        <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-main-200">
                    Название хранилища
                </label>
                <InputSmall
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={
                        isUpdateMode
                            ? "Новое название"
                            : "Например, docs-embeddings"
                    }
                    className="w-full border border-main-700/70 bg-main-900/75 px-3 py-2 text-main-50 placeholder:text-main-500 shadow-inner shadow-black/20"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-main-200">
                    Описание
                </label>
                <InputSmall
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Краткое описание хранилища"
                    className="w-full border border-main-700/70 bg-main-900/75 px-3 py-2 text-main-50 placeholder:text-main-500 shadow-inner shadow-black/20"
                />
            </div>

            {!isUpdateMode ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-main-200">
                            Папка
                        </label>

                        {fixedFolder ? (
                            <div className="rounded-full border border-main-700/70 bg-main-900/70 px-3 py-1.5 text-sm text-main-100 shadow-inner shadow-black/20">
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
                </div>
            ) : null}
        </form>
    );
};
