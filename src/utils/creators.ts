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

const normalizeStorageFileKey = (value: string): string =>
    value.trim().replace(/\\/g, "/").toLowerCase();

const hashString128 = (value: string): [number, number, number, number] => {
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;

    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);

        h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
    }

    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

    return [
        (h1 ^ h2 ^ h3 ^ h4) >>> 0,
        (h2 ^ h1) >>> 0,
        (h3 ^ h1) >>> 0,
        (h4 ^ h1) >>> 0,
    ];
};

export const createStorageFileId: (filename: string) => StorageFileIdFormat = (
    filename,
) => {
    const normalizedName = normalizeStorageFileKey(filename);

    if (!normalizedName) {
        return `fil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    const [hashA, hashB, hashC, hashD] = hashString128(normalizedName);
    const stableHash = `${hashA.toString(36).padStart(7, "0")}${hashB
        .toString(36)
        .padStart(7, "0")}${hashC.toString(36).padStart(7, "0")}${hashD
        .toString(36)
        .padStart(7, "0")}`;

    return `fil-${stableHash}`;
};

export const createStorageVecstoreId: () => StorageVecstoreIdFormat = () =>
    `vst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
