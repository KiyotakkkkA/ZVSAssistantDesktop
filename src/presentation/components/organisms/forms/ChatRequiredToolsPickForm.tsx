import { Icon } from "@iconify/react";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import { toJS } from "mobx";
import {
    Button,
    InputCheckbox,
    InputSmall,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import { profileStore } from "../../../../stores/profileStore";
import { builtInToolPacks } from "../../../../tools";

interface RequiredToolsPickFormProps {
    toolsQuery: string;
    onToolsQueryChange: (value: string) => void;
    withSectionFrame?: boolean;
}

const unique = (items: string[]) => [...new Set(items)];

export const ChatRequiredToolsPickForm = observer(
    function RequiredToolsPickForm({
        toolsQuery,
        onToolsQueryChange,
        withSectionFrame = false,
    }: RequiredToolsPickFormProps) {
        const generalData = profileStore.user?.generalData;

        const enabledTools = generalData?.enabledPromptTools ?? [];
        const requiredTools = generalData?.requiredPromptTools ?? [];

        const allToolNames = useMemo(
            () =>
                builtInToolPacks.flatMap((pack) =>
                    pack.tools.map((tool) => tool.name),
                ),
            [],
        );

        const filteredPackages = useMemo(() => {
            const query = toolsQuery.trim().toLowerCase();

            if (!query) {
                return builtInToolPacks;
            }

            return builtInToolPacks
                .map((pack) => {
                    const packageMatched =
                        pack.title.toLowerCase().includes(query) ||
                        pack.description.toLowerCase().includes(query);

                    if (packageMatched) {
                        return pack;
                    }

                    const filteredTools = pack.tools.filter((tool) => {
                        return (
                            tool.name.toLowerCase().includes(query) ||
                            tool.description.toLowerCase().includes(query)
                        );
                    });

                    return {
                        ...pack,
                        tools: filteredTools,
                    };
                })
                .filter((pack) => pack.tools.length > 0);
        }, [toolsQuery]);

        const Wrapper = withSectionFrame ? "section" : "div";

        const visibleToolNames = useMemo(
            () =>
                filteredPackages.flatMap((pack) =>
                    pack.tools.map((tool) => tool.name),
                ),
            [filteredPackages],
        );

        const allVisibleEnabled =
            visibleToolNames.length > 0 &&
            visibleToolNames.every((toolName) =>
                enabledTools.includes(toolName),
            );

        const allVisibleRequired =
            visibleToolNames.length > 0 &&
            visibleToolNames.every((toolName) =>
                requiredTools.includes(toolName),
            );

        const hasEnabledTools = enabledTools.length > 0;

        const updateToolsState = (
            nextEnabledTools: string[],
            nextRequiredTools: string[],
        ) => {
            profileStore.updateGeneralData({
                enabledPromptTools: toJS(unique(nextEnabledTools)),
                requiredPromptTools: toJS(
                    unique(nextRequiredTools).filter((name) =>
                        nextEnabledTools.includes(name),
                    ),
                ),
            });
        };

        const setEnabledTool = (toolName: string, checked: boolean) => {
            if (!generalData) {
                return;
            }

            const nextEnabled = checked
                ? unique([...enabledTools, toolName])
                : enabledTools.filter((item) => item !== toolName);

            const nextRequired = requiredTools.filter((item) =>
                nextEnabled.includes(item),
            );

            updateToolsState(nextEnabled, nextRequired);
        };

        const setRequiredTool = (toolName: string, checked: boolean) => {
            if (!generalData || !enabledTools.includes(toolName)) {
                return;
            }

            const nextRequired = checked
                ? unique([...requiredTools, toolName])
                : requiredTools.filter((item) => item !== toolName);

            updateToolsState(enabledTools, nextRequired);
        };

        const enableAllVisible = () => {
            if (!generalData) {
                return;
            }

            updateToolsState(
                [...enabledTools, ...visibleToolNames],
                requiredTools,
            );
        };

        const disableAllVisible = () => {
            if (!generalData) {
                return;
            }

            const nextEnabled = enabledTools.filter(
                (toolName) => !visibleToolNames.includes(toolName),
            );

            const nextRequired = requiredTools.filter((toolName) =>
                nextEnabled.includes(toolName),
            );

            updateToolsState(nextEnabled, nextRequired);
        };

        const makeAllVisibleRequired = () => {
            if (!generalData) {
                return;
            }

            const enabledVisible = visibleToolNames.filter((toolName) =>
                enabledTools.includes(toolName),
            );

            updateToolsState(enabledTools, [
                ...requiredTools,
                ...enabledVisible,
            ]);
        };

        const clearAllRequired = () => {
            if (!generalData) {
                return;
            }

            updateToolsState(enabledTools, []);
        };

        return (
            <Wrapper
                className={
                    withSectionFrame
                        ? "space-y-4 border-l-3 border-main-600 pl-3 animate-page-fade-in"
                        : "space-y-4 animate-page-fade-in"
                }
            >
                <div className="rounded-2xl bg-main-900/50 p-4 animate-card-rise-in">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-main-100">
                                Используемые инструменты
                            </p>
                            <p className="mt-1 text-xs text-main-400">
                                Включайте доступные инструменты и отмечайте те,
                                которые должны использоваться обязательно.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="rounded-full border border-main-600/80 bg-main-800/80 px-2.5 py-1 text-main-200">
                                Всего: {allToolNames.length}
                            </span>
                            <span className="rounded-full border border-main-600/80 bg-main-800/80 px-2.5 py-1 text-main-200">
                                Включено: {enabledTools.length}
                            </span>
                            <span className="rounded-full border border-main-600/80 bg-main-800/80 px-2.5 py-1 text-main-200">
                                Обязательных: {requiredTools.length}
                            </span>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1">
                            <InputSmall
                                value={toolsQuery}
                                onChange={(event) =>
                                    onToolsQueryChange(event.target.value)
                                }
                                placeholder="Поиск по пакетам и инструментам"
                            />
                        </div>
                        {toolsQuery.trim() ? (
                            <Button
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-9 px-3 text-xs"
                                onClick={() => onToolsQueryChange("")}
                            >
                                Сбросить
                            </Button>
                        ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                            variant="primary"
                            shape="rounded-lg"
                            className="h-8 px-3 text-xs"
                            onClick={enableAllVisible}
                            disabled={
                                visibleToolNames.length === 0 ||
                                allVisibleEnabled
                            }
                        >
                            Включить видимые
                        </Button>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-8 px-3 text-xs"
                            onClick={disableAllVisible}
                            disabled={
                                visibleToolNames.length === 0 ||
                                !hasEnabledTools
                            }
                        >
                            Выключить видимые
                        </Button>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-8 px-3 text-xs"
                            onClick={makeAllVisibleRequired}
                            disabled={
                                visibleToolNames.length === 0 ||
                                !hasEnabledTools ||
                                allVisibleRequired
                            }
                        >
                            Все обязательны
                        </Button>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-8 px-3 text-xs"
                            onClick={clearAllRequired}
                            disabled={requiredTools.length === 0}
                        >
                            Все опциональны
                        </Button>
                    </div>

                    <div className="mt-3 rounded-xl bg-main-900/40 px-3 py-2 text-xs text-main-300">
                        Действия множественного изменения применяются только к
                        инструментам, отображаемым в текущем списке, и не
                        затрагивают скрытые инструменты.
                    </div>
                </div>

                {filteredPackages.length === 0 ? (
                    <div className="rounded-xl bg-main-900/45 p-4 text-sm text-main-400 animate-card-rise-in">
                        По вашему запросу ничего не найдено.
                    </div>
                ) : (
                    filteredPackages.map((pack, packIndex) => (
                        <article
                            key={pack.id}
                            className="rounded-2xl bg-main-900/45 p-4 animate-card-rise-in"
                            style={{
                                animationDelay: `${70 + packIndex * 40}ms`,
                            }}
                        >
                            <div className="mb-3">
                                <div className="flex items-center gap-2">
                                    <Icon
                                        icon="mdi:tools"
                                        className="text-main-100"
                                    />
                                    <p className="text-base font-semibold text-main-100">
                                        {pack.title}
                                    </p>
                                </div>
                                <p className="mt-1 text-xs text-main-400">
                                    {pack.description}
                                </p>
                            </div>

                            <div className="space-y-2 border-l-2 border-main-600 pl-4">
                                {pack.tools.map((tool, toolIndex) => {
                                    const isEnabled = enabledTools.includes(
                                        tool.name,
                                    );
                                    const isRequired = requiredTools.includes(
                                        tool.name,
                                    );

                                    return (
                                        <div
                                            key={`${pack.id}_${tool.name}`}
                                            className={`flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-start md:justify-between animate-card-rise-in ${
                                                isEnabled
                                                    ? "border-main-600/80 bg-main-900/70"
                                                    : "border-main-700/70 bg-main-900/50"
                                            }`}
                                            style={{
                                                animationDelay: `${100 + toolIndex * 24}ms`,
                                            }}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Icon
                                                        icon="mdi:toolbox"
                                                        className="text-main-100"
                                                    />
                                                    <p className="text-sm font-semibold text-main-100">
                                                        {tool.name}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-xs text-main-400">
                                                    {tool.description ||
                                                        "Без описания"}
                                                </p>
                                            </div>

                                            <div className="grid min-w-64 grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-lg bg-main-950/20 p-2">
                                                <label className="contents">
                                                    <span className="flex items-center justify-end text-right text-xs text-main-300">
                                                        {isEnabled
                                                            ? "Включен"
                                                            : "Выключен"}
                                                    </span>
                                                    <span className="flex items-center justify-end">
                                                        <InputCheckbox
                                                            checked={isEnabled}
                                                            onChange={(
                                                                checked,
                                                            ) =>
                                                                setEnabledTool(
                                                                    tool.name,
                                                                    checked,
                                                                )
                                                            }
                                                        />
                                                    </span>
                                                </label>

                                                <label className="contents">
                                                    <span
                                                        className={`flex items-center justify-end text-right text-xs ${
                                                            isEnabled
                                                                ? "text-main-300"
                                                                : "text-main-500"
                                                        }`}
                                                    >
                                                        {isRequired
                                                            ? "Обязателен"
                                                            : "Не обязателен"}
                                                    </span>
                                                    <span className="flex items-center justify-end">
                                                        <InputCheckbox
                                                            checked={isRequired}
                                                            disabled={
                                                                !isEnabled
                                                            }
                                                            onChange={(
                                                                checked,
                                                            ) =>
                                                                setRequiredTool(
                                                                    tool.name,
                                                                    checked,
                                                                )
                                                            }
                                                        />
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    ))
                )}
            </Wrapper>
        );
    },
);
