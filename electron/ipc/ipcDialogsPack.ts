import type { DialogsService } from "../services/chat/DialogsService";
import type { UserProfileService } from "../services/userData/UserProfileService";
import type { ChatDialog } from "../../src/types/Chat";
import { handleManyIpc } from "./ipcUtils";

export type IpcDialogsPackDeps = {
    dialogsService: DialogsService;
    userProfileService: UserProfileService;
};

export const registerIpcDialogsPack = ({
    dialogsService,
    userProfileService,
}: IpcDialogsPackDeps) => {
    const getActiveDialogId = () =>
        userProfileService.getUserProfile().activeDialogId ?? undefined;

    handleManyIpc([
        [
            "app:get-active-dialog",
            () => dialogsService.getActiveDialog(getActiveDialogId()),
        ],
        ["app:get-dialogs-list", () => dialogsService.getDialogsList()],
        [
            "app:get-dialog-by-id",
            (dialogId: string) =>
                dialogsService.getDialogById(dialogId, getActiveDialogId()),
        ],
        [
            "app:get-dialog-context-by-id",
            (dialogId: string) =>
                dialogsService.getDialogContextById(
                    dialogId,
                    getActiveDialogId(),
                ),
        ],
        ["app:create-dialog", () => dialogsService.createDialog()],
        [
            "app:rename-dialog",
            (dialogId: string, title: string) =>
                dialogsService.renameDialog(
                    dialogId,
                    title,
                    getActiveDialogId(),
                ),
        ],
        [
            "app:delete-dialog",
            (dialogId: string) => dialogsService.deleteDialog(dialogId),
        ],
        [
            "app:delete-message-from-dialog",
            (dialogId: string, messageId: string) =>
                dialogsService.deleteMessageFromDialog(
                    dialogId,
                    messageId,
                    getActiveDialogId(),
                ),
        ],
        [
            "app:truncate-dialog-from-message",
            (dialogId: string, messageId: string) =>
                dialogsService.truncateDialogFromMessage(
                    dialogId,
                    messageId,
                    getActiveDialogId(),
                ),
        ],
        [
            "app:save-dialog-snapshot",
            (dialog: ChatDialog) => dialogsService.saveDialogSnapshot(dialog),
        ],
    ]);
};
