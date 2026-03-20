import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Icon } from "@iconify/react";
import { SettingsInterfacePanel } from "./SettingsInterfacePanel";

type SettingsRoute = "interface";

export type SettingsViewHandle = {
    save: () => Promise<{
        saved: boolean;
        scope: "general";
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
        key: "interface",
        title: "Персонализация",
        icon: "mdi:monitor",
        description: "Тема, внешний вид и отображение",
    },
];

export const SettingsView = forwardRef<SettingsViewHandle, SettingsViewProps>(
    ({ onSaveVisibilityChange }, ref) => {
        const [activeRoute, setActiveRoute] =
            useState<SettingsRoute>("interface");

        useEffect(() => {
            onSaveVisibilityChange?.(false);
        }, [activeRoute, onSaveVisibilityChange]);

        useImperativeHandle(
            ref,
            () => ({
                save: async () => {
                    return { saved: false, scope: "general" };
                },
            }),
            [],
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
                    {activeRoute === "interface" ? (
                        <SettingsInterfacePanel />
                    ) : null}
                </section>
            </div>
        );
    },
);

SettingsView.displayName = "SettingsView";
