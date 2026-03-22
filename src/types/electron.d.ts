import type {
    IpcChatNamespace,
    IpcCoreNamespace,
    IpcProfileNamespace,
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
    }
}
