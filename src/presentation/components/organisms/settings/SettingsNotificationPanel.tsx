import { Icon } from "@iconify/react";
import { InputCheckbox, PrettyBR } from "../../atoms";
import { useNotifications } from "../../../../hooks";

export const SettingsNotificationPanel = () => {
    const { settings, updateNotificationSettings } = useNotifications({
        listenJobCompletion: false,
    });

    return (
        <div className="gap-5">
            <PrettyBR icon="mdi:bell-outline" label="Задачи" size={20} />

            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:bell-outline"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${settings.notifyOnJobCompleteToast ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Уведомлять о завершённых задачах всплывающим
                                    уведомлением
                                </p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={settings.notifyOnJobCompleteToast}
                            onChange={(checked) => {
                                void updateNotificationSettings({
                                    notifyOnJobCompleteToast: checked,
                                });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:telegram"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${settings.notifyOnJobCompleteTelegram ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Уведомлять о завершённых задачах в Telegram
                                </p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={settings.notifyOnJobCompleteTelegram}
                            onChange={(checked) => {
                                void updateNotificationSettings({
                                    notifyOnJobCompleteTelegram: checked,
                                });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-2 items-center">
                            <Icon
                                icon="mdi:email-outline"
                                width={28}
                                height={28}
                                className={`text-main-300 rounded-md p-0.5 ${settings.notifyOnJobCompleteEmail ? "bg-lime-700/80" : "bg-main-700/80"}`}
                            />
                            <div>
                                <p className="text-sm font-medium text-main-200">
                                    Уведомлять о завершённых задачах по Email
                                </p>
                            </div>
                        </div>

                        <InputCheckbox
                            checked={settings.notifyOnJobCompleteEmail}
                            onChange={(checked) => {
                                void updateNotificationSettings({
                                    notifyOnJobCompleteEmail: checked,
                                });
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
