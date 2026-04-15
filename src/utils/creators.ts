export type MsgIdFormat = `msg-${string}`;
export type StageIdFormat = `stg-${string}`;
export type DialogIdFormat = `dlg-${string}`;
export type ProjectIdFormat = `prj-${string}`;
export type SecretIdFormat = `scr-${string}`;

export const createId = (): MsgIdFormat =>
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createStageId = (): StageIdFormat =>
    `stg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createDialogId = (): DialogIdFormat =>
    `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createProjectId = (): ProjectIdFormat =>
    `prj-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createSecretId = () =>
    `scr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
