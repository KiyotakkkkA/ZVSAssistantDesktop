import type {
    GetUnreadTelegramMessagesPayload,
    SendTelegramMessagePayload,
} from "../../src/types/ElectronApi";
import type { TelegramService } from "../services/communications/TelegramService";
import { handleManyIpc } from "./ipcUtils";

export type IpcCommunicationsPackDeps = {
    telegramService: TelegramService;
};

export const registerIpcCommunicationsPack = ({
    telegramService,
}: IpcCommunicationsPackDeps) => {
    handleManyIpc([
        [
            "app:communications-send-telegram-message",
            (payload: SendTelegramMessagePayload) =>
                telegramService.sendMessage(payload),
        ],
        [
            "app:communications-get-unread-telegram-messages",
            (payload: GetUnreadTelegramMessagesPayload) =>
                telegramService.getUnreadMessages(payload),
        ],
    ]);
};
