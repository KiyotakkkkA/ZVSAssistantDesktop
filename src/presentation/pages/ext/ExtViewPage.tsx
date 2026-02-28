import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Icon } from "@iconify/react";
import { Button } from "../../components/atoms";
import { useExtensions, useJobs, useToasts } from "../../../hooks";

export const ExtViewPage = observer(function ExtViewPage() {
    const toasts = useToasts();
    const { extensions, isLoading, refreshExtensions } = useExtensions();
    const { createJob, jobs } = useJobs();
    const [activeInstallJobId, setActiveInstallJobId] = useState<string | null>(
        null,
    );
    const [activeInstallExtensionId, setActiveInstallExtensionId] = useState<
        string | null
    >(null);

    useEffect(() => {
        if (extensions.length > 0) {
            return;
        }

        void refreshExtensions();
    }, [extensions.length, refreshExtensions]);

    useEffect(() => {
        if (!activeInstallJobId) {
            return;
        }

        const activeJob = jobs.find((job) => job.id === activeInstallJobId);

        if (!activeJob || activeJob.isPending) {
            return;
        }

        if (activeJob.isCompleted) {
            toasts.success({
                title: "Расширение установлено",
                description:
                    "Перезапустите приложение, чтобы обновить окружение и применить расширение во всех сервисах.",
            });
            void refreshExtensions();
        } else {
            toasts.danger({
                title: "Установка расширения не завершена",
                description:
                    activeJob.errorMessage ||
                    "Проверьте журнал задач и повторите установку.",
            });
        }

        setActiveInstallJobId(null);
        setActiveInstallExtensionId(null);
    }, [activeInstallJobId, jobs, refreshExtensions, toasts]);

    const canRenderEmpty = useMemo(
        () => !isLoading && extensions.length === 0,
        [extensions.length, isLoading],
    );

    const handleInstall = async (
        extensionId: string,
        releaseZipUrl: string,
    ) => {
        const jobResult = await createJob({
            name: `Установка расширения: ${extensionId}`,
            description:
                "Скачивание архива из GitHub и распаковка в пользовательскую папку.",
            kind: "extension-install",
            extensionId,
            extensionReleaseZipUrl: releaseZipUrl,
        });

        if (!jobResult) {
            return;
        }

        setActiveInstallJobId(jobResult.job.id);
        setActiveInstallExtensionId(extensionId);
    };

    const handleOpenInstallPath = async (targetPath: string) => {
        const api = window.appApi?.files;

        if (!api) {
            return;
        }

        const isOpened = await api.openPath(targetPath);

        if (!isOpened) {
            toasts.warning({
                title: "Не удалось открыть папку",
                description: "Проверьте путь и попробуйте ещё раз.",
            });
        }
    };

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between rounded-2xl border border-main-700/80 bg-main-900/60 px-4 py-3">
                <div>
                    <h2 className="text-base font-semibold text-main-100">
                        Расширения
                    </h2>
                    <p className="text-xs text-main-400">
                        Управление локальными расширениями приложения
                    </p>
                </div>
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-3 gap-2"
                    onClick={() => {
                        void refreshExtensions();
                    }}
                    disabled={isLoading}
                >
                    <Icon icon="mdi:refresh" width={16} height={16} />
                    Обновить
                </Button>
            </div>

            {canRenderEmpty ? (
                <div className="rounded-2xl border border-main-700/80 bg-main-900/60 px-4 py-5 text-sm text-main-300">
                    Расширения не найдены.
                </div>
            ) : null}

            <div className="grid gap-3">
                {extensions.map((extension) => {
                    const isInstalling =
                        activeInstallExtensionId === extension.id &&
                        activeInstallJobId !== null;

                    return (
                        <article
                            key={extension.id}
                            className="rounded-2xl border border-main-700/80 bg-main-900/60 px-4 py-4"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Icon
                                            icon="mdi:puzzle-outline"
                                            width={18}
                                            height={18}
                                            className="text-main-300"
                                        />
                                        <h3 className="truncate text-sm font-semibold text-main-100">
                                            {extension.title}
                                        </h3>
                                    </div>
                                    <p className="mt-1 text-xs text-main-400">
                                        {extension.description}
                                    </p>
                                    <p className="mt-2 text-[11px] text-main-500 break-all">
                                        {extension.installPath}
                                    </p>
                                </div>

                                <span
                                    className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                                        extension.isInstalled
                                            ? "bg-lime-700/20 text-lime-300"
                                            : "bg-main-700/70 text-main-300"
                                    }`}
                                >
                                    {extension.isInstalled
                                        ? "Установлено"
                                        : "Не установлено"}
                                </span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                    variant="primary"
                                    shape="rounded-lg"
                                    className="h-9 px-3 gap-2"
                                    onClick={() => {
                                        void handleInstall(
                                            extension.id,
                                            extension.releaseZipUrl,
                                        );
                                    }}
                                    disabled={isInstalling}
                                >
                                    <Icon
                                        icon={
                                            extension.isInstalled
                                                ? "mdi:update"
                                                : "mdi:download"
                                        }
                                        width={16}
                                        height={16}
                                    />
                                    {isInstalling
                                        ? "Устанавливается..."
                                        : extension.isInstalled
                                          ? "Переустановить"
                                          : "Установить"}
                                </Button>

                                <Button
                                    variant="secondary"
                                    shape="rounded-lg"
                                    className="h-9 px-3 gap-2"
                                    onClick={() => {
                                        void handleOpenInstallPath(
                                            extension.installPath,
                                        );
                                    }}
                                >
                                    <Icon
                                        icon="mdi:folder-open-outline"
                                        width={16}
                                        height={16}
                                    />
                                    Открыть папку
                                </Button>

                                <Button
                                    variant="secondary"
                                    shape="rounded-lg"
                                    className="h-9 px-3 gap-2"
                                    onClick={() => {
                                        void window.appApi?.files.openExternalUrl(
                                            extension.repositoryUrl,
                                        );
                                    }}
                                >
                                    <Icon
                                        icon="mdi:github"
                                        width={16}
                                        height={16}
                                    />
                                    GitHub
                                </Button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
});
