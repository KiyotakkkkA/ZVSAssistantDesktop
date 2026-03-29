import { useCallback, useEffect, useRef } from "react";
import { useObserver } from "mobx-react-lite";
import type { GeneralUserData } from "../../electron/models/user";
import type { JobRecord } from "../types/ElectronApi";
import { profileStore } from "../stores/profileStore";
import { useToasts } from "./useToasts";

type NotificationFields = Pick<
    GeneralUserData,
    | "notifyOnJobCompleteToast"
    | "notifyOnJobCompleteOsNotification"
    | "notifyOnJobCompleteEmail"
>;

const buildJobStatusText = (job: JobRecord) => {
    if (job.errorMessage?.trim()) {
        return {
            statusLabel: "с ошибкой",
            details: job.errorMessage.trim(),
            isError: true,
        };
    }

    if (job.isCompleted) {
        return {
            statusLabel: "успешно",
            details: "Задача выполнена.",
            isError: false,
        };
    }

    return {
        statusLabel: "с остановкой",
        details: "Задача завершена без статуса успеха.",
        isError: true,
    };
};

export const useNotifications = (
    options: { listenJobCompletion?: boolean } = {},
) => {
    const shouldListenJobCompletion = options.listenJobCompletion !== false;

    const toasts = useToasts();
    const notifiedCompletionKeysRef = useRef<Set<string>>(new Set());
    const shownEmailFallbackRef = useRef(false);

    const updateNotificationSettings = useCallback(
        (nextSettings: Partial<NotificationFields>) => {
            profileStore.updateGeneralData(nextSettings);
        },
        [],
    );

    const notifyJobCompletion = useCallback(
        async (job: JobRecord) => {
            if (job.isPending) {
                return;
            }

            const completionKey = `${job.id}:${job.updatedAt}`;

            if (notifiedCompletionKeysRef.current.has(completionKey)) {
                return;
            }

            notifiedCompletionKeysRef.current.add(completionKey);

            const profile = profileStore.user?.generalData;

            if (!profile) {
                return;
            }

            const { statusLabel, details, isError } = buildJobStatusText(job);
            const title = `Задача ${statusLabel}`;
            const description = `${job.name}. ${details}`;

            if (profile.notifyOnJobCompleteToast) {
                toasts[isError ? "danger" : "success"]({
                    title,
                    description,
                });
            }

            if (profile.notifyOnJobCompleteOsNotification) {
                try {
                    await window.core.showOsNotification({
                        title,
                        body: description,
                    });
                } catch {
                    toasts.warning({
                        title: "OS-уведомления недоступны",
                        description:
                            "Не удалось показать системное уведомление.",
                    });
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

    const notifyJobCompletionRef = useRef(notifyJobCompletion);

    useEffect(() => {
        notifyJobCompletionRef.current = notifyJobCompletion;
    }, [notifyJobCompletion]);

    useEffect(() => {
        if (!shouldListenJobCompletion) {
            return;
        }

        const unsubscribe = window.jobs.onRealtimeEvent((event) => {
            if (event.type !== "job.updated") {
                return;
            }

            void notifyJobCompletionRef.current(event.job);
        });

        return () => {
            unsubscribe();
        };
    }, [shouldListenJobCompletion]);

    return useObserver(() => ({
        isReady: profileStore.isBootstrapped,
        updateNotificationSettings,
    }));
};
