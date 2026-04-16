import type { DialogRepository } from "../repositories/DialogRepository";
import type { CreateDialogDto, UpdateDialogStateDto } from "../models/dialog";
import { handleManyIpc } from "./ipcUtils";
import { DialogIdFormat } from "../../src/utils/creators";

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
            (id: DialogIdFormat, name: string) => {
                dialogRepository.updateName(id, name);
            },
        ],
        [
            "workspace:delete-dialog",
            (id: DialogIdFormat) => {
                dialogRepository.deleteDialog(id);
            },
        ],
        [
            "workspace:update-dialog-state",
            (payload: UpdateDialogStateDto) => {
                dialogRepository.updateDialogState(payload);
            },
        ],
        [
            "workspace:update-dialog-vecstore",
            (id: DialogIdFormat, vecstoreId: string | null) => {
                dialogRepository.updateVecstoreId(id, vecstoreId);
            },
        ],
    ]);
};
