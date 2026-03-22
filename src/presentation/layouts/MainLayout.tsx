import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib";

type NavigationTab = {
    id: "workspace" | "storage" | "extensions" | "agents" | "scenarios";
    label: string;
    to: string;
    icon: string;
};

const navigationTabs: NavigationTab[] = [
    {
        id: "workspace",
        label: "Рабочая зона",
        to: "/workspace",
        icon: "mdi:view-grid-outline",
    },
    {
        id: "storage",
        label: "Хранилище",
        to: "/storage",
        icon: "mdi:database-outline",
    },
    {
        id: "extensions",
        label: "Расширения",
        to: "/extensions",
        icon: "mdi:puzzle-outline",
    },
    {
        id: "agents",
        label: "Агенты",
        to: "/agents",
        icon: "mdi:account-group-outline",
    },
    {
        id: "scenarios",
        label: "Сценарии",
        to: "/scenarios",
        icon: "mdi:file-document-edit-outline",
    },
];

export const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <main className="h-screen w-screen overflow-hidden bg-main-900 p-3 text-main-100">
            <div className="flex h-full min-h-0 w-full gap-2">
                <aside
                    className={`flex h-full min-h-0 shrink-0 flex-col rounded-3xl bg-main-800/70 p-3 backdrop-blur-md w-55 animate-panel-slide-in`}
                >
                    <div className="mb-3 flex items-center justify-start gap-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-main-400">
                            Навигация
                        </p>
                    </div>
                    <nav className="space-y-2 overflow-y-auto pr-1">
                        {navigationTabs.map((tab, index) => {
                            return (
                                <Button
                                    key={tab.id}
                                    onClick={() => navigate(tab.to)}
                                    className={`w-full justify-start text-sm transition-colors cursor-pointer p-2 gap-2 bg-transparent animate-card-rise-in ${
                                        location.pathname.startsWith(tab.to)
                                            ? "bg-main-600/60 text-main-100 hover:bg-main-600/60"
                                            : "text-main-300 hover:bg-main-700/60 hover:text-main-100"
                                    }`}
                                    title={tab.label}
                                    style={{
                                        animationDelay: `${70 + index * 45}ms`,
                                    }}
                                >
                                    <Icon
                                        icon={tab.icon}
                                        width={18}
                                        height={18}
                                    />
                                    <span>{tab.label}</span>
                                </Button>
                            );
                        })}
                    </nav>
                </aside>

                <div className="h-full min-h-0 w-full">
                    <section className="h-full min-h-0 min-w-0 overflow-hidden px-2">
                        <Outlet />
                    </section>
                </div>
            </div>
        </main>
    );
};
