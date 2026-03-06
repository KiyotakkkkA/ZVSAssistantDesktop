import { InputBig, InputSmall } from "../../atoms";
import type { UserProfile } from "../../../../types/App";

type SettingsProfilePanelProps = {
    userProfile: Pick<UserProfile, "userName" | "userPrompt" | "userLanguage">;
    updateUserProfileDraft: (
        nextDraft: Partial<
            Pick<UserProfile, "userName" | "userPrompt" | "userLanguage">
        >,
    ) => void;
};

export const SettingsProfilePanel = ({
    userProfile,
    updateUserProfileDraft,
}: SettingsProfilePanelProps) => {
    const { userName, userPrompt, userLanguage } = userProfile;

    return (
        <div className="space-y-5">
            <div className="rounded-2xl bg-main-900/40 p-4">
                <h4 className="text-sm font-semibold text-main-100">Профиль</h4>

                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">Имя</p>
                        <InputSmall
                            value={userName}
                            onChange={(event) =>
                                updateUserProfileDraft({
                                    userName: event.target.value,
                                })
                            }
                            placeholder="Пользователь"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Предпочитаемый язык
                        </p>
                        <InputSmall
                            value={userLanguage}
                            onChange={(event) =>
                                updateUserProfileDraft({
                                    userLanguage: event.target.value,
                                })
                            }
                            placeholder="Русский"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Пользовательский промпт
                        </p>
                        <InputBig
                            value={userPrompt}
                            onChange={(value) =>
                                updateUserProfileDraft({
                                    userPrompt: value.target.value,
                                })
                            }
                            placeholder="Введите инструкции для модели"
                            className="h-28 rounded-xl border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100 placeholder:text-main-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
