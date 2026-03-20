import { Icon } from "@iconify/react";
import { Button, Dropdown } from "@kiyotakkkka/zvs-uikit-lib";
import { Outlet } from "react-router-dom";
import {
    PlaceholderItem,
    SidebarItem,
} from "../components/molecules/chat/cards";

const createOptionsList = [
    {
        value: "create-dialog",
        label: "Новый диалог",
        icon: <Icon icon="mdi:chat-plus-outline" width="16" height="16" />,
        onClick: () => {
            // placeholder
        },
    },
    {
        value: "create-project",
        label: "Новый проект",
        icon: <Icon icon="mdi:folder-plus-outline" width="16" height="16" />,
        onClick: () => {
            // placeholder
        },
    },
];

const dialogs: PlaceholderItem[] = [
    {
        id: "dialog-1",
        title: "Тестовый",
        preview: "## История лемуров: от древних пре...",
        time: "01:42",
        tokens: "30 661 tok",
        active: true,
    },
    {
        id: "dialog-2",
        title: "2312313",
        preview: "Привет! Чем могу помочь?",
        time: "01:15",
        tokens: "2 513 tok",
    },
];

const projects: PlaceholderItem[] = [];

const PrettyBR = ({ icon, label }: { icon: string; label: string }) => {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-main-700/70" />
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-main-400">
                <Icon icon={icon} width={13} height={13} />
                {label}
            </div>
            <div className="h-px flex-1 bg-main-700/70" />
        </div>
    );
};

export const WorkspaceSidebar = () => {
    return (
        <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border-r border-main-300/20 bg-main-950/35 animate-page-fade-in">
            <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-main-300/20 bg-main-900/85 pr-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-main-400">
                        Рабочая область
                    </p>
                    <Dropdown
                        options={createOptionsList}
                        menuPlacement="bottom"
                        menuClassName="left-auto right-0"
                        matchTriggerWidth={false}
                        renderTrigger={({
                            toggleOpen,
                            triggerRef,
                            disabled,
                            ariaProps,
                        }) => (
                            <Button
                                label="Создать"
                                className="p-2 text-sm"
                                variant="primary"
                                ref={triggerRef}
                                disabled={disabled}
                                onClick={toggleOpen}
                                {...ariaProps}
                            >
                                <Icon icon="mdi:plus" width="14" height="14" />
                            </Button>
                        )}
                    />
                </div>

                <PrettyBR icon="mdi:chat" label="Диалоги" />

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {dialogs.map((conversation) => (
                        <SidebarItem key={conversation.id} {...conversation} />
                    ))}

                    <PrettyBR icon="mdi:folder" label="Проекты" />

                    {projects.length > 0 ? (
                        projects.map((project) => (
                            <SidebarItem key={project.id} {...project} />
                        ))
                    ) : (
                        <div className="rounded-xl bg-main-900/50 p-3 text-xs text-main-400">
                            Проекты ещё не созданы.
                        </div>
                    )}
                </div>
            </aside>

            <section className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
                <Outlet />
            </section>
        </div>
    );
};
