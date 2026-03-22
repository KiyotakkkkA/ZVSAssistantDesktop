import type { DialogRepository } from "../repositories/DialogRepository";
import type {
    CreateDialogDto,
    DialogId,
    UpdateDialogStateDto,
} from "../models/dialog";
import { handleManyIpc } from "./ipcUtils";

interface IpcWorkspacePackDeps {
    dialogRepository: DialogRepository;
}

export const registerIpcWorkspacePack = ({
    dialogRepository,
}: IpcWorkspacePackDeps) => {
    handleManyIpc([
        ["workspace:get-dialogs", () => dialogRepository.findAll()],
        [
            "workspace:create-dialog",
            (dialog: CreateDialogDto) => dialogRepository.createDialog(dialog),
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
            (payload: UpdateDialogStateDto) => {
                dialogRepository.updateDialogState(payload);
            },
        ],
    ]);
};
