import type { DialogRepository } from "../repositories/DialogRepository";
import type {
    DialogContextMessage,
    DialogId,
    DialogUiMessage,
} from "../models/dialog";
import { handleManyIpc } from "./ipcUtils";

export type IpcWorkspacePackDeps = {
    dialogRepository: DialogRepository;
};

export const registerIpcWorkspacePack = ({
    dialogRepository,
}: IpcWorkspacePackDeps) => {
    handleManyIpc([
        ["workspace:get-dialogs", () => dialogRepository.findAll()],
        [
            "workspace:create-dialog",
            (id: DialogId, name: string, isForProject: boolean) =>
                dialogRepository.createDialog({
                    id,
                    name,
                    is_for_project: isForProject,
                }),
        ],
        [
            "workspace:rename-dialog",
            (id: DialogId, name: string) => {
                dialogRepository.updateName(id, name);
            },
        ],
        [
            "workspace:delete-dialog",
            (id: DialogId) => {
                dialogRepository.deleteDialog(id);
            },
        ],
        [
            "workspace:update-dialog-state",
            (
                id: DialogId,
                uiMessages: DialogUiMessage[],
                contextMessages: DialogContextMessage[],
                tokenUsage: unknown,
            ) => {
                dialogRepository.updateDialogState(id, {
                    ui_messages: uiMessages,
                    context_messages: contextMessages,
                    token_usage: tokenUsage,
                });
            },
        ],
    ]);
};
