import {
    Button,
    InputSmall,
    Modal,
    Select,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import { useConnectors, useJobs } from "../../../../../hooks";
import {
    parseIgnorePatterns,
    resolveDefaultFolderName,
    StorageRepositorySyncProgressForm,
} from ".";
import { Icon } from "@iconify/react";
import { SecretsSelectFilling } from "../../secrets/forms";

export const StorageGitHubConnectorForm = () => {
    const { data, isLoading, isSuccess, githubRepoParse } = useConnectors();
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
    const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
    const [progressJobId, setProgressJobId] = useState<string | null>(null);

    const parsedData =
        data?.provider === "github" && data.repoUrl === repoUrl.trim()
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
            description: `Синхронизация репозитория GitHub ${parsedData.repoPath}`,
            kind: "storage-repository-sync",
            storageRepositorySync: {
                provider: "github",
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
                        URL репозитория GitHub
                    </label>
                    <InputSmall
                        placeholder="https://github.com/owner/repo"
                        value={repoUrl}
                        onChange={(event) => setRepoUrl(event.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-base font-semibold text-main-100">
                        Токен доступа GitHub
                    </label>
                    <p className="text-sm text-main-300">
                        Токен доступа для предотвращения ограничения запросов.
                    </p>
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1">
                            <InputSmall
                                value={token}
                                onChange={(event) =>
                                    setToken(event.target.value)
                                }
                                placeholder="secret..."
                                type="password"
                            />
                        </div>
                        <Button
                            type="button"
                            className="p-2 gap-2 text-sm"
                            variant="primary"
                            shape="rounded-lg"
                            onClick={() => setIsSecretsModalOpen(true)}
                        >
                            <Icon icon={"mdi:key"} />
                            Менеджер секретов
                        </Button>
                    </div>
                </div>

                {!isParsed ? (
                    <Button
                        type="button"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-8 px-3 text-xs"
                        disabled={isLoading}
                        onClick={() => {
                            void githubRepoParse(repoUrl, token);
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
                                placeholder="dist/**"
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

            <Modal
                open={isProgressModalOpen}
                onClose={() => setIsProgressModalOpen(false)}
                className="max-w-2xl"
            >
                <Modal.Header className="text-main-100">
                    Синхронизация репозитория
                </Modal.Header>

                <Modal.Content>
                    <StorageRepositorySyncProgressForm
                        open={isProgressModalOpen}
                        job={progressJob}
                        events={progressEvents}
                    />
                </Modal.Content>

                <Modal.Footer>
                    <Button
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={() => setIsProgressModalOpen(false)}
                    >
                        Закрыть
                    </Button>
                    <Button
                        variant="danger"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={!progressJob?.isPending}
                        onClick={() => {
                            if (!progressJobId) {
                                return;
                            }

                            void cancelJobById(progressJobId);
                        }}
                    >
                        Остановить
                    </Button>
                </Modal.Footer>
            </Modal>

            <SecretsSelectFilling
                open={isSecretsModalOpen}
                onClose={() => setIsSecretsModalOpen(false)}
                title="Заполнить поля GitHub"
                secretType="github"
                fieldLabel="Токен доступа"
                fieldIcon="mdi:key-chain-variant"
                onSubmit={(value) => {
                    setToken(value);

                    setIsSecretsModalOpen(false);
                }}
            />
        </>
    );
};
