export type MsgIdFormat = `msg-${string}`;
export type StageIdFormat = `stg-${string}`;
export type DialogIdFormat = `dlg-${string}`;
export type ProjectIdFormat = `prj-${string}`;
export type SecretIdFormat = `scr-${string}`;
export type StorageFolderIdFormat = `fld-${string}`;
export type StorageFileIdFormat = `fil-${string}`;
export type StorageVecstoreIdFormat = `vst-${string}`;

export const createId = (): MsgIdFormat =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createStageId = (): StageIdFormat =>
    `stg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createDialogId = (): DialogIdFormat =>
    `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createProjectId = (): ProjectIdFormat =>
    `prj-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createSecretId: () => SecretIdFormat = () =>
    `scr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createStorageFolderId: () => StorageFolderIdFormat = () =>
    `fld-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createStorageFileId: (filename: string) => StorageFileIdFormat = (
    filename,
) => {
    const normalized_name = filename.trim().toLowerCase();

    const hash_a = Array.from(normalized_name).reduce((hash, char) => {
        const next = (hash ^ char.charCodeAt(0)) * 16777619;
        return next >>> 0;
    }, 2166136261);

    const hash_b = Array.from(normalized_name).reduce((hash, char, index) => {
        const next = (hash + char.charCodeAt(0) * (index + 1)) * 31;
        return next >>> 0;
    }, 0);

    const stable_hash = `${hash_a.toString(36).padStart(7, "0")}${hash_b
        .toString(36)
        .padStart(7, "0")}`;

    return `fil-${stable_hash}`;
};

export const createStorageVecstoreId: () => StorageVecstoreIdFormat = () =>
    `vst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
