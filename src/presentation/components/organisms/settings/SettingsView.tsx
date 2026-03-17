import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Icon } from "@iconify/react";
import {
    useLogin,
    useLogout,
    useTheme,
    useToasts,
    useUserProfile,
} from "../../../../hooks";
import { authApi } from "../../../../services/api/authApi";
import type { AuthUser } from "../../../../types/Auth";
import { SettingsChatPanel } from "./SettingsChatPanel";
import { SettingsInterfacePanel } from "./SettingsInterfacePanel";
import { SettingsNotificationPanel } from "./SettingsNotificationPanel";
import { SettingsProfilePanel } from "./SettingsProfilePanel";
import { SettingsZvsAccountPanel } from "./SettingsZvsAccountPanel";

type SettingsRoute =
    | "interface"
    | "chat"
    | "notifications"
    | "profile"
    | "zvs-account";

export type SettingsViewHandle = {
    save: () => Promise<{
        saved: boolean;
        scope: "chat" | "profile" | "account" | "general";
    }>;
};

type SettingsViewProps = {
    onSaveVisibilityChange?: (isVisible: boolean) => void;
};

type SettingsRouteItem = {
    key: SettingsRoute;
    title: string;
    icon: string;
    description: string;
};

const settingsRoutes: SettingsRouteItem[] = [
    {
        key: "zvs-account",
        title: "ZVS Аккаунт",
        icon: "mdi:shield-account-outline",
        description: "Авторизация в ZVS",
    },
    {
        key: "interface",
        title: "Интерфейс",
        icon: "mdi:monitor",
        description: "Тема, внешний вид и отображение",
    },
    {
        key: "chat",
        title: "Ассистент",
        icon: "mdi:brain",
        description: "Параметры диалога и истории",
    },
    {
        key: "notifications",
        title: "Уведомления",
        icon: "mdi:bell-outline",
        description: "Оповещения о завершении задач",
    },
    {
        key: "profile",
        title: "Профиль",
        icon: "mdi:account-outline",
        description: "Данные текущего пользователя",
    },
];

export const SettingsView = forwardRef<SettingsViewHandle, SettingsViewProps>(
    ({ onSaveVisibilityChange }, ref) => {
        const loginMutation = useLogin();
        const logoutMutation = useLogout();
        const toasts = useToasts();
        const [activeRoute, setActiveRoute] = useState<SettingsRoute>("chat");
        const { userProfile, updateUserProfile } = useUserProfile();
        const { themeOptions } = useTheme();

        const [profileDraft, setProfileDraft] = useState<{
            userName: string;
            userPrompt: string;
            userLanguage: string;
        }>({
            userName: userProfile.userName,
            userPrompt: userProfile.userPrompt,
            userLanguage: userProfile.userLanguage,
        });
        const [zvsAccountDraft, setZvsAccountDraft] = useState({
            email: userProfile.zvsAuthEmail || userProfile.zvsAuthLogin,
            password: "",
        });

        const mapAuthUserToProfile = (user: AuthUser | null | undefined) => {
            const safeUser = user;

            if (!safeUser) {
                return {
                    zvsAuthUserId: "",
                    zvsAuthLogin: "",
                    zvsAuthEmail: "",
                    zvsAuthName: "",
                    zvsAuthUpdatedAt: "",
                };
            }

            return {
                zvsAuthUserId: safeUser.id ?? "",
                zvsAuthLogin: safeUser.email ?? "",
                zvsAuthEmail: safeUser.email ?? "",
                zvsAuthName: safeUser.email ?? "",
                zvsAuthUpdatedAt: new Date().toISOString(),
            };
        };

        useEffect(() => {
            setProfileDraft({
                userName: userProfile.userName,
                userPrompt: userProfile.userPrompt,
                userLanguage: userProfile.userLanguage,
            });
        }, [
            userProfile.userName,
            userProfile.userPrompt,
            userProfile.userLanguage,
        ]);

        useEffect(() => {
            setZvsAccountDraft((prev) => ({
                ...prev,
                email: userProfile.zvsAuthEmail || userProfile.zvsAuthLogin,
            }));
        }, [userProfile.zvsAuthEmail, userProfile.zvsAuthLogin]);

        const performZvsAccountLogin =
            useCallback(async (): Promise<boolean> => {
                const email = zvsAccountDraft.email.trim();
                const password = zvsAccountDraft.password;

                if (!email || !password) {
                    toasts.warning({
                        title: "Нужны данные для входа",
                        description: "Введите email и пароль.",
                    });
                    return false;
                }

                try {
                    const session = await loginMutation.mutateAsync({
                        email,
                        password,
                    });
                    const authorizedUser =
                        session.user ??
                        (await authApi.me().catch(() => {
                            return null;
                        }));

                    await updateUserProfile({
                        ...mapAuthUserToProfile(authorizedUser),
                        zvsAuthEmail:
                            typeof authorizedUser?.email === "string" &&
                            authorizedUser.email.trim().length > 0
                                ? authorizedUser.email.trim()
                                : email,
                    });
                    setZvsAccountDraft((prev) => ({
                        ...prev,
                        password: "",
                    }));

                    toasts.success({
                        title: "Успешный вход",
                        description: "Вы авторизованы в ZVS.",
                    });

                    return true;
                } catch (error) {
                    toasts.danger({
                        title: "Ошибка входа",
                        description:
                            error instanceof Error
                                ? error.message
                                : "Не удалось выполнить вход в ZVS.",
                    });
                    return false;
                }
            }, [loginMutation, toasts, updateUserProfile, zvsAccountDraft]);

        const performZvsAccountLogout =
            useCallback(async (): Promise<boolean> => {
                try {
                    await logoutMutation.mutateAsync({
                        refreshToken: undefined,
                    });

                    await updateUserProfile({
                        zvsAuthUserId: "",
                        zvsAuthLogin: "",
                        zvsAuthEmail: "",
                        zvsAuthName: "",
                        zvsAuthUpdatedAt: "",
                    });

                    setZvsAccountDraft((prev) => ({
                        ...prev,
                        password: "",
                    }));

                    toasts.success({
                        title: "Выход выполнен",
                    });
                    return true;
                } catch (error) {
                    toasts.danger({
                        title: "Ошибка выхода",
                        description:
                            error instanceof Error
                                ? error.message
                                : "Не удалось завершить сессию ZVS.",
                    });
                    return false;
                }
            }, [logoutMutation, toasts, updateUserProfile]);

        useEffect(() => {
            onSaveVisibilityChange?.(activeRoute === "profile");
        }, [activeRoute, onSaveVisibilityChange]);

        useImperativeHandle(
            ref,
            () => ({
                save: async () => {
                    if (activeRoute === "profile") {
                        await updateUserProfile({
                            userName:
                                profileDraft.userName.trim() || "Пользователь",
                            userPrompt: profileDraft.userPrompt,
                            userLanguage: profileDraft.userLanguage,
                        });
                        return { saved: true, scope: "profile" };
                    }

                    return { saved: false, scope: "general" };
                },
            }),
            [activeRoute, profileDraft, updateUserProfile],
        );

        const renderedPanel: Record<SettingsRoute, ReactNode> = useMemo(
            () => ({
                interface: (
                    <SettingsInterfacePanel
                        userProfile={userProfile}
                        themeOptions={themeOptions}
                        updateUserProfile={(nextProfile) => {
                            void updateUserProfile(nextProfile);
                        }}
                    />
                ),
                chat: <SettingsChatPanel />,
                notifications: <SettingsNotificationPanel />,
                profile: (
                    <SettingsProfilePanel
                        userProfile={profileDraft}
                        updateUserProfileDraft={(nextDraft) => {
                            setProfileDraft((prev) => ({
                                ...prev,
                                ...nextDraft,
                            }));
                        }}
                    />
                ),
                "zvs-account": (
                    <SettingsZvsAccountPanel
                        email={zvsAccountDraft.email}
                        password={zvsAccountDraft.password}
                        isLoading={loginMutation.isPending}
                        isLogoutLoading={logoutMutation.isPending}
                        updateDraft={(nextDraft) => {
                            setZvsAccountDraft((prev) => ({
                                ...prev,
                                ...nextDraft,
                            }));
                        }}
                        onLogin={() => {
                            void performZvsAccountLogin();
                        }}
                        onLogout={() => {
                            void performZvsAccountLogout();
                        }}
                    />
                ),
            }),
            [
                loginMutation.isPending,
                logoutMutation.isPending,
                performZvsAccountLogin,
                performZvsAccountLogout,
                profileDraft,
                themeOptions,
                updateUserProfile,
                userProfile,
                zvsAccountDraft,
            ],
        );

        return (
            <div className="grid h-full min-h-[68vh] gap-6 md:grid-cols-[300px_1fr]">
                <aside className="min-h-0 md:border-r md:border-main-700/80 md:pr-3">
                    <nav className="space-y-2 md:h-full md:overflow-y-auto md:pr-2">
                        {settingsRoutes.map((route) => {
                            const isActive = route.key === activeRoute;

                            return (
                                <button
                                    key={route.key}
                                    type="button"
                                    onClick={() => setActiveRoute(route.key)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer ${
                                        isActive
                                            ? "bg-main-700/60 text-main-100"
                                            : "text-main-300 hover:bg-main-800/60 hover:text-main-100"
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <Icon
                                            icon={route.icon}
                                            width="16"
                                            height="16"
                                        />
                                        {route.title}
                                    </span>
                                    <span className="mt-1 block text-xs font-normal leading-4 text-main-400">
                                        {route.description}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <section className="min-h-0 overflow-y-auto overflow-x-hidden pr-1 md:pr-2">
                    {renderedPanel[activeRoute]}
                </section>
            </div>
        );
    },
);

SettingsView.displayName = "SettingsView";
