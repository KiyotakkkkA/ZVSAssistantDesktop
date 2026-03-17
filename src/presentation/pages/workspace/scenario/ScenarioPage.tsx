import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate, useParams } from "react-router-dom";
import { useFileDownload, useFileUpload, useToasts } from "../../../../hooks";
import { useScenario } from "../../../../hooks/agents";
import { Button, InputSmall, TreeView } from "../../../components/atoms";
import {
    ScenarioCanvas,
    type ScenarioCanvasInsertRequest,
} from "../../../components/organisms/scenarios";
import { ScenarioAiChatPanel } from "../../../components/organisms/scenarios/support/ScenarioAiChatPanel";
import { toolsStore } from "../../../../stores/toolsStore";
import { Icon } from "@iconify/react";
import type { Scenario } from "../../../../types/Scenario";
import { LoadingFallbackPage } from "../../LoadingFallbackPage";

type ImportedScenarioPayload = {
    name?: unknown;
    description?: unknown;
    content?: unknown;
};

const tryParseImportedScenario = (
    rawText: string,
): ImportedScenarioPayload | null => {
    try {
        const parsed = JSON.parse(rawText) as unknown;

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }

        return parsed as ImportedScenarioPayload;
    } catch {
        return null;
    }
};

export const ScenarioPage = observer(function ScenarioPage() {
    const { scenarioId = "" } = useParams();
    const navigate = useNavigate();
    const toasts = useToasts();
    const { activeScenario, switchScenario, updateScenario } = useScenario();
    const { isUploading, pickFiles } = useFileUpload();
    const [isLoading, setIsLoading] = useState(true);
    const scenarioExportJson = useMemo(() => {
        if (!activeScenario) {
            return "";
        }

        const exportPayload: Record<string, unknown> = {
            name: activeScenario.name,
            description: activeScenario.description,
            content: activeScenario.content,
        };

        return JSON.stringify(exportPayload, null, 2);
    }, [activeScenario]);

    const downloadScenarioJson = useFileDownload(
        scenarioExportJson,
        `${(activeScenario?.name || "scenario").replace(/[\\/:*?"<>|]/g, "_")}.json`,
    );

    const handleExportScenario = useCallback(() => {
        if (!activeScenario) {
            toasts.warning({
                title: "Сценарий не найден",
                description: "Нечего экспортировать.",
            });
            return;
        }

        downloadScenarioJson();
    }, [activeScenario, downloadScenarioJson, toasts]);

    const handleImportScenario = useCallback(async () => {
        if (!activeScenario) {
            toasts.warning({
                title: "Сценарий не найден",
                description: "Сначала откройте сценарий для импорта.",
            });
            return;
        }

        const files = await pickFiles({
            accept: ["application/json", ".json"],
            multiple: false,
        });

        const file = files[0];
        if (!file) {
            return;
        }

        try {
            const rawText = await fetch(file.dataUrl).then((response) =>
                response.text(),
            );
            const imported = tryParseImportedScenario(rawText);

            if (!imported) {
                toasts.warning({
                    title: "Некорректный JSON",
                    description:
                        "Файл импорта должен содержать объект сценария.",
                });
                return;
            }

            const importedName =
                typeof imported.name === "string" &&
                imported.name.trim().length > 0
                    ? imported.name.trim()
                    : activeScenario.name;
            const importedDescription =
                typeof imported.description === "string"
                    ? imported.description
                    : activeScenario.description;
            const importedContent =
                imported.content &&
                typeof imported.content === "object" &&
                !Array.isArray(imported.content)
                    ? (imported.content as Scenario["content"])
                    : activeScenario.content;

            const updated = await updateScenario(activeScenario.id, {
                name: importedName,
                description: importedDescription,
                content: importedContent,
            });

            if (!updated) {
                toasts.danger({
                    title: "Ошибка импорта",
                    description:
                        "Не удалось применить импортированный сценарий.",
                });
                return;
            }

            toasts.success({
                title: "Импорт завершён",
                description: "Сценарий успешно обновлён из JSON.",
            });
        } catch {
            toasts.danger({
                title: "Ошибка импорта",
                description: "Не удалось прочитать выбранный файл.",
            });
        }
    }, [activeScenario, pickFiles, toasts, updateScenario]);

    const [insertRequest, setInsertRequest] =
        useState<ScenarioCanvasInsertRequest | null>(null);
    const [toolsQuery, setToolsQuery] = useState("");

    const requestInsert = useCallback(
        (payload: Omit<ScenarioCanvasInsertRequest, "token">) => {
            setInsertRequest({
                ...payload,
                token: Date.now(),
            });
        },
        [],
    );

    const normalizedToolsQuery = toolsQuery.trim().toLowerCase();

    const filteredToolPackages = useMemo(() => {
        if (!normalizedToolsQuery) {
            return toolsStore.packages;
        }

        const categoryMatch = "ии инструменты".includes(normalizedToolsQuery);

        if (categoryMatch) {
            return toolsStore.packages;
        }

        return toolsStore.getFilteredPackages(toolsQuery);
    }, [normalizedToolsQuery, toolsQuery]);

    const baseStructures = useMemo(
        () => [
            {
                key: "variable",
                label: "Переменная",
                description: "Вёычисляемые переменные сценария",
                onClick: () => {
                    requestInsert({ kind: "variable" });
                },
            },
            {
                key: "prompt",
                label: "Инструкция",
                description: "Блок инструкции",
                onClick: () => {
                    requestInsert({ kind: "prompt" });
                },
            },
            {
                key: "condition",
                label: "Условие",
                description: "Условие с ветками Да/Нет",
                onClick: () => {
                    requestInsert({ kind: "condition" });
                },
            },
        ],
        [requestInsert],
    );

    const filteredBaseStructures = useMemo(() => {
        if (!normalizedToolsQuery) {
            return baseStructures;
        }

        const categoryMatch = "базовые структуры".includes(
            normalizedToolsQuery,
        );
        if (categoryMatch) {
            return baseStructures;
        }

        return baseStructures.filter((item) => {
            const haystack = `${item.label} ${item.description}`.toLowerCase();
            return haystack.includes(normalizedToolsQuery);
        });
    }, [baseStructures, normalizedToolsQuery]);

    const showNoResults =
        normalizedToolsQuery.length > 0 &&
        filteredToolPackages.length === 0 &&
        filteredBaseStructures.length === 0;

    useEffect(() => {
        setIsLoading(true);

        if (!scenarioId) {
            setIsLoading(false);
            return;
        }

        let isCancelled = false;

        void (async () => {
            const scenario = await switchScenario(scenarioId);

            if (isCancelled) {
                return;
            }

            if (!scenario) {
                toasts.warning({
                    title: "Сценарий не найден",
                    description: "Открыт список диалогов по умолчанию.",
                });
                navigate("/workspace/dialogs", { replace: true });
                return;
            }

            setIsLoading(false);
        })();

        return () => {
            isCancelled = true;
        };
    }, [navigate, scenarioId, switchScenario, toasts]);

    if (isLoading) {
        return <LoadingFallbackPage title="Загрузка сценария..." />;
    }

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="flex justify-between items-start">
                <div className="rounded-2xl bg-main-900/60 p-4">
                    <h1 className="text-lg font-semibold text-main-100">
                        {activeScenario?.name || "Сценарий"}
                    </h1>
                    <p className="mt-2 text-sm text-main-300">
                        {activeScenario?.description?.trim() ||
                            "Описание сценария пока не задано."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        className="gap-2 p-2"
                        variant="primary"
                        shape="rounded-lg"
                        onClick={handleExportScenario}
                        disabled={!activeScenario}
                    >
                        <Icon icon="mdi:download" width={16} height={16} />
                        Экспорт в JSON
                    </Button>
                    <Button
                        className="gap-2 p-2"
                        variant="secondary"
                        shape="rounded-lg"
                        onClick={() => {
                            void handleImportScenario();
                        }}
                        disabled={!activeScenario || isUploading}
                    >
                        <Icon icon="mdi:upload" width={16} height={16} />
                        Импорт из JSON
                    </Button>
                </div>
            </div>
            <div className="relative flex min-h-0 flex-1 gap-4">
                <aside className="w-80">
                    <TreeView className="h-full overflow-y-auto">
                        <div className="pb-3">
                            <InputSmall
                                value={toolsQuery}
                                onChange={(event) =>
                                    setToolsQuery(event.target.value)
                                }
                                placeholder="Поиск..."
                            />
                        </div>

                        {showNoResults ? (
                            <div className="rounded-xl border border-main-700/70 bg-main-900/45 p-3 text-xs text-main-400">
                                Ничего не найдено по вашему запросу.
                            </div>
                        ) : null}

                        {filteredToolPackages.length > 0 ? (
                            <TreeView.Catalog
                                title="ИИ инструменты"
                                defaultOpen
                            >
                                {filteredToolPackages.map((pkg) => (
                                    <TreeView.Catalog
                                        key={pkg.id}
                                        title={pkg.title}
                                        defaultOpen
                                    >
                                        {pkg.tools.map((tool) => (
                                            <TreeView.Element
                                                key={tool.schema.function.name}
                                                label={
                                                    tool.schema.function.name
                                                }
                                                description={
                                                    tool.schema.function
                                                        .description
                                                }
                                                onClick={() => {
                                                    requestInsert({
                                                        kind: "tool",
                                                        toolName:
                                                            tool.schema.function
                                                                .name,
                                                        toolSchema:
                                                            JSON.stringify(
                                                                tool.schema
                                                                    .function
                                                                    .parameters,
                                                                null,
                                                                2,
                                                            ),
                                                        ...(tool.outputScheme
                                                            ? {
                                                                  outputScheme:
                                                                      JSON.stringify(
                                                                          tool.outputScheme,
                                                                          null,
                                                                          2,
                                                                      ),
                                                              }
                                                            : {}),
                                                    });
                                                }}
                                            />
                                        ))}
                                    </TreeView.Catalog>
                                ))}
                            </TreeView.Catalog>
                        ) : null}

                        {filteredBaseStructures.length > 0 ? (
                            <TreeView.Catalog
                                title="Базовые структуры"
                                defaultOpen
                            >
                                {filteredBaseStructures.map((item) => (
                                    <TreeView.Element
                                        key={item.key}
                                        label={item.label}
                                        description={item.description}
                                        onClick={item.onClick}
                                    />
                                ))}
                            </TreeView.Catalog>
                        ) : null}
                    </TreeView>
                </aside>
                <ScenarioCanvas
                    insertRequest={insertRequest}
                    onInsertHandled={() => setInsertRequest(null)}
                />
                <ScenarioAiChatPanel />
            </div>
        </section>
    );
});
