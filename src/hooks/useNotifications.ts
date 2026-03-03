import { useCallback, useEffect, useRef } from "react";
import { useObserver } from "mobx-react-lite";
import type { UserProfile } from "../types/App";
import type { JobRecord } from "../types/ElectronApi";
import { userProfileStore } from "../stores/userProfileStore";
import { useToasts } from "./useToasts";

type NotificationFields = Pick<
    UserProfile,
    | "notifyOnJobCompleteToast"
    | "notifyOnJobCompleteTelegram"
    | "notifyOnJobCompleteEmail"
>;

const buildJobStatusText = (job: JobRecord) => {
    if (job.errorMessage?.trim()) {
        return {
            statusLabel: "с ошибкой",
            details: job.errorMessage.trim(),
        };
    }

    if (job.isCompleted) {
        return {
            statusLabel: "успешно",
            details: "Задача выполнена.",
        };
    }

    return {
        statusLabel: "с остановкой",
        details: "Задача завершена без статуса успеха.",
    };
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

export const useNotifications = (
    options: { listenJobCompletion?: boolean } = {},
) => {
    const shouldListenJobCompletion = options.listenJobCompletion !== false;

    const toasts = useToasts();
    const notifiedCompletionKeysRef = useRef<Set<string>>(new Set());
    const shownEmailFallbackRef = useRef(false);
    const shownTelegramConfigWarningRef = useRef(false);

    const updateNotificationSettings = useCallback(
        async (nextSettings: Partial<NotificationFields>) => {
            await userProfileStore.updateUserProfile(nextSettings);
        },
        [],
    );

    const notifyJobCompletion = useCallback(
        async (job: JobRecord) => {
            if (job.isPending) {
                return;
            }

            const completionKey = `${job.id}:${job.updatedAt}:${job.isPending}`;
            if (notifiedCompletionKeysRef.current.has(completionKey)) {
                return;
            }
            notifiedCompletionKeysRef.current.add(completionKey);

            const profile = userProfileStore.userProfile;
            const { statusLabel, details } = buildJobStatusText(job);

            if (profile.notifyOnJobCompleteToast) {
                const isError = Boolean(job.errorMessage?.trim());

                toasts[isError ? "danger" : "success"]({
                    title: `Задача ${statusLabel}`,
                    description: `${job.name}. ${details}`,
                });
            }

            if (profile.notifyOnJobCompleteTelegram) {
                const communicationsApi = window.appApi?.communications;
                const telegramBotToken = profile.telegramBotToken.trim();
                const telegramId = profile.telegramId.trim();

                if (!communicationsApi) {
                    toasts.warning({
                        title: "Telegram недоступен",
                        description:
                            "Namespace communications не инициализирован.",
                    });
                } else if (!telegramBotToken || !telegramId) {
                    if (!shownTelegramConfigWarningRef.current) {
                        shownTelegramConfigWarningRef.current = true;
                        toasts.warning({
                            title: "Telegram не настроен",
                            description:
                                "Укажите Bot Token и Telegram ID в настройках чата.",
                        });
                    }
                } else {
                    const statusIcon = job.errorMessage?.trim()
                        ? "❌"
                        : job.isCompleted
                          ? "✅"
                          : "⚠️";
                    const statusTitle = job.errorMessage?.trim()
                        ? "Задача завершилась с ошибкой"
                        : job.isCompleted
                          ? "Задача успешно завершена"
                          : "Задача завершилась с остановкой";
                    const safeJobName = escapeHtml(job.name || "Без названия");
                    const safeJobDescription = escapeHtml(
                        job.description || "—",
                    );
                    const safeDetails = escapeHtml(details);

                    const telegramText =
                        `<b>${statusIcon} ${statusTitle}</b>\n` +
                        `<b>Статус:</b> ${escapeHtml(statusLabel)}\n` +
                        `<b>Название:</b> ${safeJobName}\n` +
                        `<b>Описание:</b> ${safeJobDescription}\n` +
                        `<b>Детали:</b> ${safeDetails}`;

                    try {
                        console.log(
                            "Sending Telegram notification about job completion:",
                            {
                                telegramId,
                                jobId: job.id,
                                status: statusLabel,
                                message: telegramText,
                            },
                        );
                        await communicationsApi.sendTelegramMessage({
                            telegramBotToken,
                            telegramId,
                            message: telegramText,
                            parseMode: "HTML",
                        });
                    } catch (error) {
                        toasts.warning({
                            title: "Ошибка Telegram-уведомления",
                            description: `Не удалось отправить сообщение о завершении задачи: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
                        });
                    }
                }
            }

            if (
                profile.notifyOnJobCompleteEmail &&
                !shownEmailFallbackRef.current
            ) {
                shownEmailFallbackRef.current = true;
                toasts.info({
                    title: "Email-уведомления",
                    description:
                        "Email-канал пока не реализован. Настройка сохранена для будущей версии.",
                });
            }
        },
        [toasts],
    );

    useEffect(() => {
        if (!shouldListenJobCompletion) {
            return;
        }

        const jobsApi = window.appApi?.jobs;

        if (!jobsApi?.onJobEvent) {
            return;
        }

        const unsubscribe = jobsApi.onJobEvent((event) => {
            if (event.type !== "job.updated") {
                return;
            }

            void notifyJobCompletion(event.job);
        });

        return () => {
            unsubscribe();
        };
    }, [notifyJobCompletion, shouldListenJobCompletion]);

    return useObserver(() => ({
        isReady: userProfileStore.isReady,
        settings: {
            notifyOnJobCompleteToast:
                userProfileStore.userProfile.notifyOnJobCompleteToast,
            notifyOnJobCompleteTelegram:
                userProfileStore.userProfile.notifyOnJobCompleteTelegram,
            notifyOnJobCompleteEmail:
                userProfileStore.userProfile.notifyOnJobCompleteEmail,
        },
        updateNotificationSettings,
    }));
};
