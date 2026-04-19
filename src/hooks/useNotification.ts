import { useCallback, useEffect, useRef } from "react";
import type { GeneralUserData } from "../../electron/models/user";
import type { JobRecord } from "../types/ElectronApi";
import { profileStore } from "../stores/profileStore";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../data/MsgToasts";

type NotificationFields = Pick<
    GeneralUserData,
    | "notifyOnJobCompleteToast"
    | "notifyOnJobCompleteOsNotification"
    | "notifyOnJobCompleteEmail"
>;

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

            const title = `Задача ${job.name}`;
            const description = `${job.description}`;

            if (profile.notifyOnJobCompleteToast) {
                if (job.errorMessage) {
                    toasts.danger;
                    MsgToasts.JOB_EXECUTION_ERROR(job.name, job.errorMessage);
                    return;
                }
                toasts.success(MsgToasts.JOB_SUCCESSFULLY_COMPLETED(job.name));
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

    return {
        isReady: profileStore.isBootstrapped,
        updateNotificationSettings,
    };
};
