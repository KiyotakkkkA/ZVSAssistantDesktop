import type {
    IpcChatNamespace,
    IpcCoreNamespace,
    IpcJobsNamespace,
    IpcProfileNamespace,
    IpcSecretsNamespace,
    IpcStorageNamespace,
    IpcWorkspaceNamespace,
} from "../../electron/namespaces";
import type { DialogEntity } from "../../electron/models/dialog";

export {};

export type PersistedDialog = DialogEntity;

declare global {
    interface Window {
        core: IpcCoreNamespace;
        chat: IpcChatNamespace;
        profile: IpcProfileNamespace;
        workspace: IpcWorkspaceNamespace;
        jobs: IpcJobsNamespace;
        storage: IpcStorageNamespace;
        secrets: IpcSecretsNamespace;
    }
}
