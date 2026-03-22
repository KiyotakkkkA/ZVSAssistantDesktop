import { Icon } from "@iconify/react";
import {
    Button,
    Dropdown,
    InputSmall,
    Modal,
} from "@kiyotakkkka/zvs-uikit-lib";
import { Outlet } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import {
    PlaceholderItem,
    SidebarItem,
} from "../components/molecules/chat/cards";
import { workspaceStore } from "../../stores/workspaceStore";
import { useToasts } from "../../hooks/useToasts";

type TargetType = "dialog" | "project";

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

export const WorkspaceSidebar = observer(() => {
    const toast = useToasts();
    const [renameTarget, setRenameTarget] = useState<{
        type: TargetType;
        id: string;
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        type: TargetType;
        id: string;
    } | null>(null);
    const [newTitle, setNewTitle] = useState("");

    const createOptionsList = [
        {
            value: "create-dialog",
            label: "Новый диалог",
            icon: <Icon icon="mdi:chat-plus-outline" width="16" height="16" />,
            onClick: () => {
                workspaceStore.createDialog();
                toast.success({
                    title: "Успешно",
                    description: "Новый диалог успешно создан.",
                });
            },
        },
        {
            value: "create-project",
            label: "Новый проект",
            icon: (
                <Icon icon="mdi:folder-plus-outline" width="16" height="16" />
            ),
            onClick: () => {},
        },
    ];

    const closeRenameModal = () => {
        setRenameTarget(null);
        setNewTitle("");
    };

    const closeDeleteModal = () => {
        setDeleteTarget(null);
    };

    const submitRename = () => {
        if (!renameTarget) {
            return;
        }

        if (renameTarget.type === "dialog") {
            workspaceStore.renameDialog(
                renameTarget.id as `dlg-${string}`,
                newTitle,
            );
        } else {
            workspaceStore.renameProject(
                renameTarget.id as `prj-${string}`,
                newTitle,
            );
        }

        closeRenameModal();
        toast.success({
            title: "Успешно",
            description: "Название успешно обновлено.",
        });
    };

    const submitDelete = () => {
        if (!deleteTarget) {
            return;
        }

        if (deleteTarget.type === "dialog") {
            workspaceStore.deleteDialog(deleteTarget.id as `dlg-${string}`);
        } else {
            workspaceStore.deleteProject(deleteTarget.id as `prj-${string}`);
        }

        closeDeleteModal();
        toast.success({
            title: "Успешно",
            description: "Элемент успешно удалён.",
        });
    };

    const dialogs: PlaceholderItem[] = workspaceStore.dialogs
        .filter((dialog) => !dialog.isForProject)
        .map((dialog) => ({
            id: dialog.id,
            title: dialog.name,
            preview: dialog.messages.at(-1)?.content || "История пока пуста.",
            time: dialog.messages.at(-1)?.timestamp || "--:--",
            active:
                workspaceStore.activeProjectId === null &&
                workspaceStore.activeDialogId === dialog.id,
            onSelect: (id) => {
                workspaceStore.openDialog(id as `dlg-${string}`);
            },
            onRename: (id) => {
                setRenameTarget({ type: "dialog", id });
                setNewTitle(dialog.name);
            },
            onDelete: (id) => {
                setDeleteTarget({ type: "dialog", id });
            },
        }));

    const projects: PlaceholderItem[] = workspaceStore.projects.map(
        (project) => {
            const linkedDialog = workspaceStore.dialogs.find(
                (dialog) => dialog.id === project.dialogId,
            );

            return {
                id: project.id,
                title: project.title,
                preview:
                    linkedDialog?.messages.at(-1)?.content ||
                    "Диалог проекта пока пуст.",
                time: linkedDialog?.messages.at(-1)?.timestamp || "--:--",
                active: workspaceStore.activeProjectId === project.id,
                onSelect: (id) => {
                    workspaceStore.openProject(id as `prj-${string}`);
                },
                onRename: (id) => {
                    setRenameTarget({ type: "project", id });
                    setNewTitle(project.title);
                },
                onDelete: (id) => {
                    setDeleteTarget({ type: "project", id });
                },
            };
        },
    );

    return (
        <div className="flex h-full min-h-0 overflow-hidden animate-page-fade-in">
            <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-main-300/20 bg-main-900/85 pr-3 animate-panel-slide-in">
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
                    {dialogs.length > 0 ? (
                        dialogs.map((dialog, index) => (
                            <div
                                key={dialog.id}
                                className="animate-card-rise-in"
                                style={{
                                    animationDelay: `${50 + index * 24}ms`,
                                }}
                            >
                                <SidebarItem {...dialog} />
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl bg-main-900/50 px-3 text-xs text-main-400">
                            Диалоги ещё не созданы.
                        </div>
                    )}

                    <PrettyBR icon="mdi:folder" label="Проекты" />

                    {projects.length > 0 ? (
                        projects.map((project, index) => (
                            <div
                                key={project.id}
                                className="animate-card-rise-in"
                                style={{
                                    animationDelay: `${80 + index * 24}ms`,
                                }}
                            >
                                <SidebarItem {...project} />
                            </div>
                        ))
                    ) : (
                        <div className="rounded-xl bg-main-900/50 px-3 text-xs text-main-400">
                            Проекты ещё не созданы.
                        </div>
                    )}
                </div>
            </aside>

            <section className="min-h-0 min-w-0 flex-1 overflow-hidden p-2 ">
                <Outlet />
            </section>

            <Modal
                closeOnOverlayClick={false}
                open={Boolean(renameTarget)}
                onClose={closeRenameModal}
                title={
                    renameTarget?.type === "project"
                        ? "Переименовать проект"
                        : "Переименовать диалог"
                }
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeRenameModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={submitRename}
                        >
                            Сохранить
                        </Button>
                    </>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-main-300">Новое название</p>
                    <InputSmall
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder="Введите название"
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                submitRename();
                            }
                        }}
                    />
                </div>
            </Modal>

            <Modal
                open={Boolean(deleteTarget)}
                onClose={closeDeleteModal}
                title={
                    deleteTarget?.type === "project"
                        ? "Удаление проекта"
                        : "Удаление диалога"
                }
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeDeleteModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={submitDelete}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Подтвердите удаление выбранного элемента.
                </p>
            </Modal>
        </div>
    );
});
