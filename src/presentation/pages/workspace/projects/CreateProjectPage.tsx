import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { toolsStore } from "../../../../stores/toolsStore";
import { useProjects, useToasts } from "../../../../hooks";
import { useFileSave } from "../../../../hooks/files";
import type { UploadedFileData } from "../../../../types/ElectronApi";
import {
    Button,
    InputBig,
    InputCheckbox,
    InputFile,
    InputPath,
    InputSmall,
    Modal,
} from "../../../components/atoms";
import { RequiredToolsPickForm } from "../../../components/organisms/forms";

export const CreateProjectPage = observer(function CreateProjectPage() {
    const navigate = useNavigate();
    const toasts = useToasts();
    const { createProject } = useProjects();
    const { saveFiles, isSaving } = useFileSave();

    const [projectName, setProjectName] = useState("");
    const [projectDescription, setProjectDescription] = useState("");
    const [defaultProjectsDirectory, setDefaultProjectsDirectory] =
        useState("");
    const [useDefaultDirectory, setUseDefaultDirectory] = useState(true);
    const [projectDirectoryPath, setProjectDirectoryPath] = useState("");
    const [toolsQuery, setToolsQuery] = useState("");
    const [documents, setDocuments] = useState<UploadedFileData[]>([]);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        let isCancelled = false;

        void (async () => {
            const path =
                await window.appApi?.projects.getDefaultProjectsDirectory();

            if (isCancelled || !path) {
                return;
            }

            setDefaultProjectsDirectory(path);
            setProjectDirectoryPath(path);
        })();

        return () => {
            isCancelled = true;
        };
    }, []);

    const selectedBaseDirectory = useDefaultDirectory
        ? defaultProjectsDirectory
        : projectDirectoryPath.trim();

    const formNewProjData = (fileUUIDs: string[]) => {
        return {
            name: projectName.trim(),
            description: projectDescription.trim(),
            directoryPath: selectedBaseDirectory,
            requiredTools: toolsStore.requiredPromptTools,
            fileUUIDs,
        };
    };

    const openConfirmModal = () => {
        if (!projectName.trim()) {
            toasts.warning({
                title: "Введите название",
                description: "Название проекта не может быть пустым.",
            });
            return;
        }

        if (!selectedBaseDirectory) {
            toasts.warning({
                title: "Выберите директорию",
                description: "Укажите директорию для создания папки проекта.",
            });
            return;
        }

        setIsConfirmOpen(true);
    };

    const confirmCreateProject = async () => {
        if (isCreating) {
            return;
        }

        try {
            setIsCreating(true);

            const savedFiles =
                documents.length > 0 ? await saveFiles(documents) : [];
            const project = await createProject(
                formNewProjData(savedFiles.map((file) => file.id)),
            );

            if (!project) {
                toasts.danger({
                    title: "Ошибка создания",
                    description: "Не удалось создать проект.",
                });
                return;
            }

            toasts.success({
                title: "Проект создан",
                description: "Проект добавлен в рабочую область.",
            });

            setIsConfirmOpen(false);
            navigate(`/workspace/projects/${project.id}`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-main-900/60">
                <div className="flex-1 space-y-6 overflow-y-auto p-1">
                    <div>
                        <h2 className="text-lg font-semibold text-main-100">
                            Создание проекта
                        </h2>
                        <p className="mt-2 text-sm text-main-300">
                            Заполните базовые параметры проекта.
                        </p>
                    </div>

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <p className="text-sm font-semibold text-main-100">
                            Название проекта
                        </p>
                        <InputSmall
                            value={projectName}
                            onChange={(event) =>
                                setProjectName(event.target.value)
                            }
                            placeholder="Название проекта"
                        />
                    </section>

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <p className="text-sm font-semibold text-main-100">
                            Описание проекта
                        </p>
                        <InputBig
                            value={projectDescription}
                            onChange={(event) =>
                                setProjectDescription(event.target.value)
                            }
                            className="h-28! rounded-xl! border border-main-700/70 bg-main-800/70 px-3 py-2 text-main-100 placeholder:text-main-500"
                            placeholder="Опишите цель и контекст проекта"
                        />
                    </section>

                    <RequiredToolsPickForm
                        toolsQuery={toolsQuery}
                        onToolsQueryChange={setToolsQuery}
                        withSectionFrame
                    />

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <p className="text-sm font-semibold text-main-100">
                            Директория проекта
                        </p>
                        <div className="rounded-xl border border-main-700/70 bg-main-900/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-main-200">
                                        Использовать директорию по умолчанию
                                    </p>
                                    <p className="mt-1 text-xs text-main-400">
                                        {defaultProjectsDirectory ||
                                            "Загрузка пути по умолчанию..."}
                                    </p>
                                </div>
                                <InputCheckbox
                                    checked={useDefaultDirectory}
                                    onChange={(checked) => {
                                        setUseDefaultDirectory(checked);

                                        if (checked) {
                                            setProjectDirectoryPath(
                                                defaultProjectsDirectory,
                                            );
                                        }
                                    }}
                                />
                            </div>

                            {!useDefaultDirectory ? (
                                <InputPath
                                    className="mt-3"
                                    label="Своя директория"
                                    helperText="Выберите базовую папку. Папка проекта с UUID будет создана внутри неё"
                                    value={projectDirectoryPath}
                                    onChange={setProjectDirectoryPath}
                                    placeholder="Директория не выбрана"
                                    forFolders
                                />
                            ) : null}
                        </div>
                    </section>

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <InputFile
                            label="Документы"
                            helperText="Добавьте материалы проекта через проводник"
                            value={documents}
                            onChange={setDocuments}
                            accept={["image/*", ".pdf", ".docx"]}
                            multiple
                        />
                    </section>
                </div>

                <div className="p-4">
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={isCreating || isSaving}
                        onClick={openConfirmModal}
                    >
                        Создать проект
                    </Button>
                </div>

                <Modal
                    open={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    title="Подтверждение создания проекта"
                    className="max-w-md"
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-9 px-4"
                                onClick={() => setIsConfirmOpen(false)}
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="primary"
                                shape="rounded-lg"
                                className="h-9 px-4"
                                disabled={isCreating || isSaving}
                                onClick={() => {
                                    void confirmCreateProject();
                                }}
                            >
                                {isCreating || isSaving
                                    ? "Создание..."
                                    : "Подтвердить"}
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-2 text-sm text-main-300">
                        <p>
                            Подтвердите создание проекта с выбранными
                            параметрами.
                        </p>
                        <p>
                            <span className="text-main-400">Название:</span>{" "}
                            {projectName.trim()}
                        </p>
                        <p>
                            <span className="text-main-400">Документы:</span>{" "}
                            {documents.length}
                        </p>
                        <p>
                            <span className="text-main-400">Директория:</span>{" "}
                            {selectedBaseDirectory || "Не выбрана"}
                        </p>
                    </div>
                </Modal>
            </div>
        </section>
    );
});
