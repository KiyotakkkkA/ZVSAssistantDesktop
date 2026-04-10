import { Button, InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import { useConnectors } from "../../../../../hooks";

export const StorageGitLabConnectorForm = () => {
    const { data, isLoading, isSuccess, gitlabRepoParse } = useConnectors();

    const [repoUrl, setRepoUrl] = useState("");
    const [token, setToken] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [ignoreFiles, setIgnoreFiles] = useState("");

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

    return (
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
                            className="h-11 w-64 rounded-xl border border-main-700/70 bg-main-900/70"
                            wrapperClassName="w-full max-w-60"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-base font-semibold text-main-100">
                            Игнорирование файлов
                        </label>
                        <p className="text-sm text-main-300">
                            Список в формате .gitignore для исключения
                            определённых файлов при сборе. Нажмите Enter после
                            каждой записи.
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
                    >
                        Подключить
                    </Button>
                </>
            )}
        </form>
    );
};
