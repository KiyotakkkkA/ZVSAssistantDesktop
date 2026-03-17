import { PrettyBR } from "../../atoms";
import { useNotifications } from "../../../../hooks";
import { SettingsColoredCheckboxRow } from "../../molecules/cards/settings";

export const SettingsNotificationPanel = () => {
    const { settings, updateNotificationSettings } = useNotifications({
        listenJobCompletion: false,
    });

    return (
        <div className="gap-5">
            <PrettyBR icon="mdi:bell-outline" label="Задачи" size={20} />

            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="space-y-4">
                    <SettingsColoredCheckboxRow
                        checked={settings.notifyOnJobCompleteToast}
                        icon={"mdi:bell-outline"}
                        label={
                            "Уведомлять о завершённых задачах всплывающим уведомлением"
                        }
                        description={
                            "Вы получите уведомление внутри приложения, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteToast: checked,
                            });
                        }}
                    />

                    <SettingsColoredCheckboxRow
                        checked={settings.notifyOnJobCompleteTelegram}
                        icon={"mdi:telegram"}
                        label={"Уведомлять о завершённых задачах в Telegram"}
                        description={
                            "Вы получите уведомление в Telegram, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteTelegram: checked,
                            });
                        }}
                    />

                    <SettingsColoredCheckboxRow
                        checked={settings.notifyOnJobCompleteEmail}
                        icon={"mdi:email-outline"}
                        label={"Уведомлять о завершённых задачах по Email"}
                        description={
                            "Вы получите уведомление по Email, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteEmail: checked,
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
