import { PrettyBR } from "@kiyotakkkka/zvs-uikit-lib";
import { useNotifications } from "../../../../hooks";
import { SettingsColoredCheckboxRow } from "../../molecules/settings";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../../../stores/profileStore";

const toBool = (value: unknown) => value === true;

export const SettingsNotificationPanel = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;

    const { updateNotificationSettings } = useNotifications({
        listenJobCompletion: false,
    });

    return (
        <div className="gap-5">
            <PrettyBR icon="mdi:bell-outline" label="Задачи" size={20} />

            <div className="rounded-2xl bg-main-900/40 p-5">
                <div className="space-y-4">
                    <SettingsColoredCheckboxRow
                        checked={toBool(generalData?.notifyOnJobCompleteToast)}
                        icon={"mdi:bell-outline"}
                        label={
                            "Уведомлять о завершённых задачах всплывающим уведомлением внутри приложения"
                        }
                        description={
                            "Вы получите всплывающее уведомление внутри приложения, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteToast: toBool(checked),
                            });
                        }}
                    />

                    <SettingsColoredCheckboxRow
                        checked={toBool(
                            generalData?.notifyOnJobCompleteOsNotification,
                        )}
                        icon={"mdi:bell-outline"}
                        label={
                            "Уведомлять о завершённых задачах всплывающим уведомлением операционной системы"
                        }
                        description={
                            "Вы получите всплывающее уведомление от операционной системы, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteOsNotification:
                                    toBool(checked),
                            });
                        }}
                    />

                    <PrettyBR
                        icon="mdi:hammer"
                        label="В разработке"
                        size={20}
                    />

                    <SettingsColoredCheckboxRow
                        checked={toBool(generalData?.notifyOnJobCompleteEmail)}
                        icon={"mdi:email-outline"}
                        label={
                            "Уведомлять о завершённых задачах по Email (WIP)"
                        }
                        description={
                            "Вы получите уведомление по Email, когда задача будет завершена"
                        }
                        onChange={(checked) => {
                            void updateNotificationSettings({
                                notifyOnJobCompleteEmail: toBool(checked),
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
});
