import type {
    GetUnreadTelegramMessagesPayload,
    SendTelegramMessagePayload,
} from "../../types/ElectronApi";

type SendTelegramInput = SendTelegramMessagePayload;

type GetUnreadTelegramInput = GetUnreadTelegramMessagesPayload;

export function escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

const getCommunicationsApi = () => {
    const api = window.appApi;

    if (!api?.communications) {
        throw new Error("communications_unavailable");
    }

    return api.communications;
};

export const sendTelegramMessageViaProxy = async ({
    telegramBotToken,
    telegramId,
    message,
    parseMode,
}: SendTelegramInput) => {
    const communicationsApi = getCommunicationsApi();
    const formattedMessage =
        parseMode === "MarkdownV2" ? escapeMarkdownV2(message) : message;

    return communicationsApi.sendTelegramMessage({
        telegramBotToken,
        telegramId,
        message: formattedMessage,
        parseMode,
    });
};

const clampLimit = (value?: number): number => {
    if (!Number.isFinite(value)) {
        return 20;
    }

    const safeValue = Math.floor(value as number);
    if (safeValue < 1) {
        return 1;
    }
    if (safeValue > 100) {
        return 100;
    }

    return safeValue;
};

export const getUnreadTelegramMessagesViaProxy = async ({
    telegramBotToken,
    telegramId,
    limit,
    markAsRead,
}: GetUnreadTelegramInput) => {
    const communicationsApi = getCommunicationsApi();
    const safeLimit = clampLimit(limit);

    return communicationsApi.getUnreadTelegramMessages({
        telegramBotToken,
        telegramId,
        limit: safeLimit,
        markAsRead,
    });
};
