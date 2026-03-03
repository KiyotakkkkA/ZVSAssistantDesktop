import type {
    GetUnreadTelegramMessagesPayload,
    GetUnreadTelegramMessagesResult,
    SendTelegramMessagePayload,
    SendTelegramMessageResult,
} from "../../../src/types/ElectronApi";

type TelegramUpdate = {
    update_id: number;
    message?: {
        message_id?: number;
        date?: number;
        text?: string;
        chat?: {
            id?: number | string;
            type?: string;
            title?: string;
            username?: string;
            first_name?: string;
            last_name?: string;
        };
        from?: {
            id?: number;
            is_bot?: boolean;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
        };
    };
};

const TELEGRAM_BOT_BASE_URL = "https://api.telegram.org/bot";

export class TelegramService {
    private escapeMarkdownV2(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
    }

    private clampLimit(value?: number): number {
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
    }

    private async request<TResult>(
        telegramBotToken: string,
        methodName: string,
        payload: Record<string, unknown>,
    ): Promise<{ ok: boolean; result?: TResult; description?: string }> {
        const response = await fetch(
            `${TELEGRAM_BOT_BASE_URL}${telegramBotToken}/${methodName}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        );

        if (!response.ok) {
            throw new Error(`request_failed_${response.status}`);
        }

        let parsed: { ok: boolean; result?: TResult; description?: string };
        try {
            parsed = (await response.json()) as {
                ok: boolean;
                result?: TResult;
                description?: string;
            };
        } catch {
            throw new Error("invalid_telegram_response");
        }

        return parsed;
    }

    async sendMessage({
        telegramBotToken,
        telegramId,
        message,
        parseMode,
    }: SendTelegramMessagePayload): Promise<SendTelegramMessageResult> {
        const formattedMessage =
            parseMode === "MarkdownV2"
                ? this.escapeMarkdownV2(message)
                : message;

        const response = await this.request<{ message_id?: number }>(
            telegramBotToken,
            "sendMessage",
            {
                chat_id: telegramId,
                text: formattedMessage,
                parse_mode: parseMode,
            },
        );

        if (!response.ok) {
            return {
                success: false,
                error: response.description ?? "unknown",
                message: "failed",
            };
        }

        return {
            success: true,
            message: "sent",
            message_id: response.result?.message_id,
        };
    }

    async getUnreadMessages({
        telegramBotToken,
        telegramId,
        limit,
        markAsRead,
    }: GetUnreadTelegramMessagesPayload): Promise<GetUnreadTelegramMessagesResult> {
        const safeLimit = this.clampLimit(limit);
        const shouldMarkAsRead = markAsRead !== false;
        const offset = 0;

        const response = await this.request<TelegramUpdate[]>(
            telegramBotToken,
            "getUpdates",
            {
                offset,
                limit: safeLimit,
                timeout: 0,
                allowed_updates: ["message"],
            },
        );

        if (!response.ok) {
            return {
                success: false,
                error: response.description ?? "unknown",
                message: "failed",
            };
        }

        const updates = Array.isArray(response.result) ? response.result : [];
        const nextOffset =
            updates.length > 0
                ? Math.max(...updates.map((item) => item.update_id)) + 1
                : offset;

        if (shouldMarkAsRead && nextOffset > 0) {
            await this.request<TelegramUpdate[]>(
                telegramBotToken,
                "getUpdates",
                {
                    offset: nextOffset,
                    limit: 1,
                    timeout: 0,
                    allowed_updates: ["message"],
                },
            );
        }

        const userMessages = updates
            .filter((update) => {
                const chatId = update.message?.chat?.id;
                return String(chatId ?? "") === String(telegramId);
            })
            .map((update) => ({
                update_id: update.update_id,
                message_id: update.message?.message_id,
                date: update.message?.date,
                text: update.message?.text ?? "",
                chat: {
                    id: update.message?.chat?.id,
                    type: update.message?.chat?.type,
                    title: update.message?.chat?.title,
                    username: update.message?.chat?.username,
                    first_name: update.message?.chat?.first_name,
                    last_name: update.message?.chat?.last_name,
                },
                from: {
                    id: update.message?.from?.id,
                    is_bot: update.message?.from?.is_bot,
                    first_name: update.message?.from?.first_name,
                    last_name: update.message?.from?.last_name,
                    username: update.message?.from?.username,
                    language_code: update.message?.from?.language_code,
                },
            }));

        return {
            success: true,
            message: "ok",
            unread_count: userMessages.length,
            updates_count: updates.length,
            offset_used: offset,
            next_offset: shouldMarkAsRead ? nextOffset : offset,
            messages: userMessages,
        };
    }
}
