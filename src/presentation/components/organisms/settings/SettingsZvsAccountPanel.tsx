import { InputSmall } from "../../atoms";

type SettingsZvsAccountPanelProps = {
    login: string;
    password: string;
    updateDraft: (
        nextDraft: Partial<{ login: string; password: string }>,
    ) => void;
};

export const SettingsZvsAccountPanel = ({
    login,
    password,
    updateDraft,
}: SettingsZvsAccountPanelProps) => {
    return (
        <div className="space-y-5">
            <div className="rounded-2xl bg-main-900/40 p-4">
                <h4 className="text-sm font-semibold text-main-100">
                    ZVS Аккаунт
                </h4>

                <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Логин
                        </p>
                        <InputSmall
                            value={login}
                            onChange={(event) =>
                                updateDraft({
                                    login: event.target.value,
                                })
                            }
                            placeholder="Введите логин"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-main-200">
                            Пароль
                        </p>
                        <InputSmall
                            value={password}
                            type="password"
                            onChange={(event) =>
                                updateDraft({
                                    password: event.target.value,
                                })
                            }
                            placeholder="Введите пароль"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
