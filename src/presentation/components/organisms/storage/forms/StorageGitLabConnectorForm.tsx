import { Button, InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import { useConnectors, useJobs } from "../../../../../hooks";
import {
    parseIgnorePatterns,
    resolveDefaultFolderName,
    StorageRepositorySyncProgressModalForm,
} from ".";

export const StorageGitLabConnectorForm = () => {
    const { data, isLoading, isSuccess, gitlabRepoParse } = useConnectors();
    const {
        createJob,
        cancelJobById,
        getJobById,
        selectedJobEvents,
        selectedJobId,
        selectJob,
    } = useJobs();

    const [repoUrl, setRepoUrl] = useState("");
    const [token, setToken] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [ignoreFiles, setIgnoreFiles] = useState("");
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [progressJobId, setProgressJobId] = useState<string | null>(null);

    const parsedData =
        data?.provider === "gitlab" && data.repoUrl === repoUrl.trim()
            ? data
            : null;
    const isParsed = isSuccess && Boolean(parsedData);

    const branchOptions = useMemo(
        () =>
            (parsedData?.branches || []).map((branch) => ({
                value: branch,
                label: branch,
            })),
        [parsedData],
    );

    useEffect(() => {
        if (!parsedData) {
            return;
        }

        setSelectedBranch(parsedData.defaultBranch || parsedData.branches[0]);
    }, [parsedData]);

    useEffect(() => {
        if (!progressJobId) {
            return;
        }

        selectJob(progressJobId);
    }, [progressJobId, selectJob]);

    const progressJob = progressJobId ? getJobById(progressJobId) : null;
    const progressEvents =
        progressJobId && selectedJobId === progressJobId
            ? selectedJobEvents
            : [];

    const handleStartSync = async () => {
        if (!parsedData || !selectedBranch) {
            return;
        }

        const created = await createJob({
            name: `sync_${parsedData.repoPath}`,
            description: `Синхронизация репозитория GitLab ${parsedData.repoPath}`,
            kind: "storage-repository-sync",
            storageRepositorySync: {
                provider: "gitlab",
                repoUrl: parsedData.repoUrl,
                branch: selectedBranch,
                token: token.trim() || undefined,
                ignorePatterns: parseIgnorePatterns(ignoreFiles),
                folderName: resolveDefaultFolderName(parsedData.repoPath),
            },
        });

        if (!created) {
            return;
        }

        setProgressJobId(created.job.id);
        setIsProgressModalOpen(true);
    };

    return (
        <>
            <form className="space-y-5">
                <div className="space-y-2">
                    <label className="block text-base font-semibold text-main-100">
                        URL репозитория GitLab
                    </label>
                    <InputSmall
                        placeholder="https://gitlab.com/username/repo"
                        value={repoUrl}
                        onChange={(event) => setRepoUrl(event.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-base font-semibold text-main-100">
                        Токен доступа GitLab
                    </label>
                    <p className="text-sm text-main-300">
                        Персональный токен доступа для приватных репозиториев.
                    </p>
                    <InputSmall
                        type="password"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="secret..."
                    />
                </div>

                {!isParsed ? (
                    <Button
                        type="button"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-8 px-3 text-xs"
                        disabled={isLoading}
                        onClick={() => {
                            void gitlabRepoParse(repoUrl, token);
                        }}
                    >
                        {isLoading ? "Получение данных..." : "Получить данные"}
                    </Button>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="block text-base font-semibold text-main-100">
                                Ветка
                            </label>
                            <p className="text-sm text-main-300">
                                Ветка, из которой нужно собрать файлы.
                            </p>
                            <Select
                                value={selectedBranch}
                                onChange={setSelectedBranch}
                                options={branchOptions}
                                classNames={{
                                    menu: "border border-main-700/70 shadow-lg bg-main-900/92 backdrop-blur-md",
                                    trigger: "bg-main-700/45 w-64",
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-base font-semibold text-main-100">
                                Игнорирование файлов
                            </label>
                            <p className="text-sm text-main-300">
                                Список в формате .gitignore для исключения
                                определённых файлов при сборе. Нажмите Enter
                                после каждой записи.
                            </p>
                            <InputSmall
                                type="text"
                                placeholder="build/**"
                                className="h-11 w-full"
                                value={ignoreFiles}
                                onChange={(event) =>
                                    setIgnoreFiles(event.target.value)
                                }
                            />
                        </div>

                        <Button
                            type="button"
                            variant="primary"
                            shape="rounded-lg"
                            className="h-10 w-full"
                            onClick={() => {
                                void handleStartSync();
                            }}
                        >
                            Подключить
                        </Button>
                    </>
                )}
            </form>

            <StorageRepositorySyncProgressModalForm
                open={isProgressModalOpen}
                job={progressJob}
                events={progressEvents}
                onClose={() => setIsProgressModalOpen(false)}
                onCancel={() => {
                    if (!progressJobId) {
                        return;
                    }

                    void cancelJobById(progressJobId);
                }}
            />
        </>
    );
};
