import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { useLocation, useNavigate } from "react-router-dom";
import { useDialogs, useProjects, useToasts } from "../../../../hooks";
import { useScenario } from "../../../../hooks/agents";
import {
    Button,
    Dropdown,
    InputBig,
    InputSmall,
    Modal,
    PrettyBR,
} from "../../atoms";
import {
    ConversationItem,
    ProjectsItem,
    ScenarioItem,
} from "../../molecules/cards/workspace";
import { Icon } from "@iconify/react";
import { chatRuntimeStore } from "../../../../stores/chatRuntimeStore";

export const ChatSidebar = observer(function ChatSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const toasts = useToasts();
    const {
        dialogs,
        activeDialogId,
        createDialog,
        renameDialog,
        deleteDialog,
        switchDialog,
        canDeleteDialog,
    } = useDialogs();
    const { projects, activeProjectId, clearActiveProject, deleteProject } =
        useProjects();
    const {
        scenarios,
        activeScenarioId,
        switchScenario,
        updateScenario,
        deleteScenario,
        clearActiveScenario,
    } = useScenario();

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editMode, setEditMode] = useState<"create" | "rename">("create");
    const [dialogName, setDialogName] = useState("");
    const [targetDialogId, setTargetDialogId] = useState<string | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
    const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] =
        useState(false);
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
    const [isDeleteScenarioModalOpen, setIsDeleteScenarioModalOpen] =
        useState(false);
    const [deleteScenarioId, setDeleteScenarioId] = useState<string | null>(
        null,
    );

    const [isEditScenarioModalOpen, setIsEditScenarioModalOpen] =
        useState(false);
    const [editScenarioId, setEditScenarioId] = useState<string | null>(null);
    const [scenarioName, setScenarioName] = useState("");
    const [scenarioDescription, setScenarioDescription] = useState("");
    const [isChatNavigationWarningOpen, setIsChatNavigationWarningOpen] =
        useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<
        (() => void | Promise<void>) | null
    >(null);

    const editModalTitle =
        editMode === "create" ? "Создать диалог" : "Переименовать диалог";

    const activeSection = useMemo<"dialogs" | "projects" | "scenario">(() => {
        const pathname = location.pathname;

        if (pathname.startsWith("/workspace/projects")) {
            return "projects";
        }

        if (pathname.startsWith("/workspace/scenario")) {
            return "scenario";
        }

        return "dialogs";
    }, [location.pathname]);

    const requestChatSafeNavigation = (action: () => void | Promise<void>) => {
        if (!chatRuntimeStore.isChatBusy) {
            void action();
            return;
        }

        setPendingNavigation(() => action);
        setIsChatNavigationWarningOpen(true);
    };

    const closeChatNavigationWarning = () => {
        setIsChatNavigationWarningOpen(false);
        setPendingNavigation(null);
    };

    const confirmInterruptedNavigation = async () => {
        const nextNavigation = pendingNavigation;

        closeChatNavigationWarning();

        if (!nextNavigation) {
            return;
        }

        await chatRuntimeStore.interruptActiveSession();
        await nextNavigation();
    };

    const openCreateModal = () => {
        requestChatSafeNavigation(() => {
            navigate("/workspace/dialogs");
            setEditMode("create");
            setDialogName("");
            setTargetDialogId(null);
            setIsEditModalOpen(true);
        });
    };

    const openProjectsPage = () => {
        requestChatSafeNavigation(() => {
            navigate("/workspace/projects/create");
        });
    };

    const openScenarioPage = () => {
        requestChatSafeNavigation(() => {
            navigate("/workspace/scenario/create");
        });
    };

    const selectDialogAndOpenPage = (dialogId: string) => {
        requestChatSafeNavigation(() => {
            navigate("/workspace/dialogs");
            void switchDialog(dialogId);
        });
    };

    const selectProjectAndOpenPage = (projectId: string) => {
        requestChatSafeNavigation(() => {
            navigate(`/workspace/projects/${projectId}`);
        });
    };

    const selectScenarioAndOpenPage = (scenarioId: string) => {
        requestChatSafeNavigation(() => {
            navigate(`/workspace/scenario/${scenarioId}`);
        });
    };

    const createOptionsList = [
        {
            value: "dialog",
            label: "Новый диалог",
            icon: <Icon icon="mdi:plus-circle-outline" width={20} />,
            onClick: openCreateModal,
        },
        {
            value: "project",
            label: "Новый проект",
            icon: <Icon icon="mdi:plus-box-multiple" width={20} />,
            onClick: openProjectsPage,
        },
        {
            value: "scenario",
            label: "Новый сценарий",
            icon: <Icon icon="mdi:script" width={20} />,
            onClick: openScenarioPage,
        },
    ];

    const openRenameModal = (dialogId: string) => {
        const current = dialogs.find((dialog) => dialog.id === dialogId);

        setEditMode("rename");
        setTargetDialogId(dialogId);
        setDialogName(current?.title ?? "");
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setDialogName("");
        setTargetDialogId(null);
    };

    const submitEditModal = async () => {
        const nextName = dialogName.trim();

        if (!nextName) {
            toasts.warning({
                title: "Введите название",
                description: "Название диалога не может быть пустым.",
            });
            return;
        }

        if (editMode === "create") {
            await createDialog(nextName);
            toasts.success({
                title: "Диалог создан",
                description: "Новый диалог добавлен в рабочую область.",
            });
            closeEditModal();
            return;
        }

        if (!targetDialogId) {
            return;
        }

        await renameDialog(targetDialogId, nextName);
        toasts.success({
            title: "Диалог обновлён",
            description: "Название диалога успешно изменено.",
        });
        closeEditModal();
    };

    const openDeleteModal = (dialogId: string) => {
        if (!canDeleteDialog) {
            toasts.warning({
                title: "Нельзя удалить",
                description:
                    "В рабочей области должен остаться хотя бы один диалог.",
            });
            return;
        }

        setDeleteDialogId(dialogId);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setDeleteDialogId(null);
    };

    const openDeleteProjectModal = (projectId: string) => {
        setDeleteProjectId(projectId);
        setIsDeleteProjectModalOpen(true);
    };

    const closeDeleteProjectModal = () => {
        setDeleteProjectId(null);
        setIsDeleteProjectModalOpen(false);
    };

    const openEditScenarioModal = async (scenarioId: string) => {
        const scenario = await switchScenario(scenarioId);

        if (!scenario) {
            toasts.warning({
                title: "Сценарий не найден",
                description: "Не удалось загрузить данные сценария.",
            });
            return;
        }

        setEditScenarioId(scenario.id);
        setScenarioName(scenario.name);
        setScenarioDescription(scenario.description);
        setIsEditScenarioModalOpen(true);
    };

    const closeEditScenarioModal = () => {
        setEditScenarioId(null);
        setScenarioName("");
        setScenarioDescription("");
        setIsEditScenarioModalOpen(false);
    };

    const submitEditScenarioModal = async () => {
        if (!editScenarioId) {
            return;
        }

        const nextName = scenarioName.trim();

        if (!nextName) {
            toasts.warning({
                title: "Введите название",
                description: "Название сценария не может быть пустым.",
            });
            return;
        }

        const updated = await updateScenario(editScenarioId, {
            name: nextName,
            description: scenarioDescription.trim(),
        });

        if (!updated) {
            toasts.warning({
                title: "Не удалось обновить",
                description: "Сценарий не найден или уже удалён.",
            });
            return;
        }

        toasts.success({
            title: "Сценарий обновлён",
            description: "Название и описание сценария сохранены.",
        });

        closeEditScenarioModal();
    };

    const openDeleteScenarioModal = (scenarioId: string) => {
        setDeleteScenarioId(scenarioId);
        setIsDeleteScenarioModalOpen(true);
    };

    const closeDeleteScenarioModal = () => {
        setDeleteScenarioId(null);
        setIsDeleteScenarioModalOpen(false);
    };

    const confirmDelete = async () => {
        if (!deleteDialogId) {
            return;
        }

        await deleteDialog(deleteDialogId);
        toasts.success({
            title: "Диалог удалён",
            description: "Диалог был удалён из списка.",
        });
        closeDeleteModal();
    };

    const confirmDeleteProject = async () => {
        if (!deleteProjectId) {
            return;
        }

        const deleted = await deleteProject(deleteProjectId);

        if (!deleted) {
            toasts.warning({
                title: "Не удалось удалить",
                description: "Проект не найден или уже удалён.",
            });
            closeDeleteProjectModal();
            return;
        }

        if (activeProjectId === deleteProjectId) {
            clearActiveProject();
            navigate("/workspace/dialogs");
        }

        toasts.info({
            title: "Проект удалён",
            description: "Проект, его диалог и документы удалены.",
        });

        closeDeleteProjectModal();
    };

    const confirmDeleteScenario = async () => {
        if (!deleteScenarioId) {
            return;
        }

        const deleted = await deleteScenario(deleteScenarioId);

        if (!deleted) {
            toasts.warning({
                title: "Не удалось удалить",
                description: "Сценарий не найден или уже удалён.",
            });
            closeDeleteScenarioModal();
            return;
        }

        if (activeScenarioId === deleteScenarioId) {
            clearActiveScenario();
            navigate("/workspace/dialogs");
        }

        toasts.info({
            title: "Сценарий удалён",
            description: "Сценарий удалён из рабочей области.",
        });

        closeDeleteScenarioModal();
    };

    return (
        <aside className="flex h-full w-[320px] flex-col bg-main-900/85 p-4 border-r border-main-300/20 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 pb-4 ">
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
                            ref={triggerRef}
                            disabled={disabled}
                            onClick={toggleOpen}
                            {...ariaProps}
                        >
                            + Создать
                        </Button>
                    )}
                />
            </div>

            <PrettyBR icon="mdi:chat" label="Диалоги" />

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {dialogs.map((conversation) => (
                    <ConversationItem
                        key={conversation.id}
                        active={
                            activeSection === "dialogs" &&
                            conversation.id === activeDialogId
                        }
                        onSelect={selectDialogAndOpenPage}
                        onRename={openRenameModal}
                        onDelete={openDeleteModal}
                        canDelete={canDeleteDialog}
                        {...conversation}
                    />
                ))}

                <PrettyBR icon="mdi:folder" label="Проекты" />

                {projects.length > 0 ? (
                    projects.map((project) => (
                        <ProjectsItem
                            key={project.id}
                            id={project.id}
                            title={project.title}
                            preview={project.preview}
                            time={project.time}
                            active={
                                activeSection === "projects" &&
                                project.id === activeProjectId
                            }
                            onSelect={selectProjectAndOpenPage}
                            onDelete={openDeleteProjectModal}
                        />
                    ))
                ) : (
                    <div className="rounded-xl bg-main-900/50 p-3 text-xs text-main-400">
                        Проекты ещё не созданы.
                    </div>
                )}

                <PrettyBR icon="mdi:script" label="Сценарии" />

                {scenarios.length > 0 ? (
                    scenarios.map((scenario) => (
                        <ScenarioItem
                            key={scenario.id}
                            id={scenario.id}
                            title={scenario.title}
                            preview={scenario.preview}
                            time={scenario.time}
                            active={
                                activeSection === "scenario" &&
                                scenario.id === activeScenarioId
                            }
                            onSelect={(scenarioId) => {
                                void selectScenarioAndOpenPage(scenarioId);
                            }}
                            onEdit={(scenarioId) => {
                                void openEditScenarioModal(scenarioId);
                            }}
                            onDelete={openDeleteScenarioModal}
                        />
                    ))
                ) : (
                    <div className="rounded-xl bg-main-900/50 p-3 text-xs text-main-400">
                        Сценарии ещё не созданы.
                    </div>
                )}
            </div>

            <Modal
                open={isEditModalOpen}
                onClose={closeEditModal}
                title={editModalTitle}
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeEditModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={submitEditModal}
                        >
                            Сохранить
                        </Button>
                    </>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-main-300">Название диалога</p>
                    <InputSmall
                        value={dialogName}
                        onChange={(event) => setDialogName(event.target.value)}
                        placeholder="Введите название"
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void submitEditModal();
                            }
                        }}
                    />
                </div>
            </Modal>

            <Modal
                open={isDeleteModalOpen}
                onClose={closeDeleteModal}
                title="Удаление диалога"
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
                            onClick={confirmDelete}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Подтвердите удаление выбранного диалога.
                </p>
            </Modal>

            <Modal
                open={isDeleteProjectModalOpen}
                onClose={closeDeleteProjectModal}
                title="Удаление проекта"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeDeleteProjectModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void confirmDeleteProject();
                            }}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Подтвердите удаление проекта вместе с диалогом и файлами.
                </p>
            </Modal>

            <Modal
                open={isEditScenarioModalOpen}
                onClose={closeEditScenarioModal}
                title="Редактирование сценария"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeEditScenarioModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void submitEditScenarioModal();
                            }}
                        >
                            Сохранить
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="space-y-2">
                        <p className="text-sm text-main-300">
                            Название сценария
                        </p>
                        <InputSmall
                            value={scenarioName}
                            onChange={(event) =>
                                setScenarioName(event.target.value)
                            }
                            placeholder="Введите название"
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-main-300">
                            Описание сценария
                        </p>
                        <InputBig
                            value={scenarioDescription}
                            onChange={(value) =>
                                setScenarioDescription(value.target.value)
                            }
                            className="h-28! rounded-xl! border border-main-700/70 bg-main-800/70 px-3 py-2 text-main-100 placeholder:text-main-500"
                            placeholder="Введите описание"
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                open={isDeleteScenarioModalOpen}
                onClose={closeDeleteScenarioModal}
                title="Удаление сценария"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeDeleteScenarioModal}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void confirmDeleteScenario();
                            }}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Подтвердите удаление выбранного сценария.
                </p>
            </Modal>

            <Modal
                open={isChatNavigationWarningOpen}
                onClose={closeChatNavigationWarning}
                title="Переход недоступен"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={closeChatNavigationWarning}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void confirmInterruptedNavigation();
                            }}
                        >
                            Прервать
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Модель находится в процессе ответа, прервите процесс чтобы
                    перейти.
                </p>
            </Modal>
        </aside>
    );
});
