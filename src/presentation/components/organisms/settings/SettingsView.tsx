import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Icon } from "@iconify/react";
import { useTheme, useUserProfile } from "../../../../hooks";
import { SettingsChatPanel } from "./SettingsChatPanel";
import { SettingsInterfacePanel } from "./SettingsInterfacePanel";
import { SettingsNotificationPanel } from "./SettingsNotificationPanel";
import { SettingsProfilePanel } from "./SettingsProfilePanel";

type SettingsRoute = "interface" | "chat" | "notifications" | "profile";

export type SettingsViewHandle = {
    save: () => Promise<{
        saved: boolean;
        scope: "chat" | "profile" | "general";
    }>;
};

type SettingsRouteItem = {
    key: SettingsRoute;
    title: string;
    icon: string;
    description: string;
};

const settingsRoutes: SettingsRouteItem[] = [
    {
        key: "interface",
        title: "Интерфейс",
        icon: "mdi:monitor",
        description: "Тема, внешний вид и отображение",
    },
    {
        key: "chat",
        title: "Чат",
        icon: "mdi:message-outline",
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

export const SettingsView = forwardRef<SettingsViewHandle>((_, ref) => {
    const [activeRoute, setActiveRoute] = useState<SettingsRoute>("interface");
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

    useImperativeHandle(
        ref,
        () => ({
            save: async () => {
                if (activeRoute === "chat") {
                    return { saved: true, scope: "chat" };
                }

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
        }),
        [profileDraft, themeOptions, updateUserProfile, userProfile],
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
});

SettingsView.displayName = "SettingsView";
