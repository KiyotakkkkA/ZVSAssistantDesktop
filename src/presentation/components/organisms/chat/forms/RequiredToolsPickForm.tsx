import { Icon } from "@iconify/react";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import { toJS } from "mobx";
import { InputCheckbox, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { profileStore } from "../../../../../stores/profileStore";
import { builtInToolPacks } from "../../../../../tools";

interface RequiredToolsPickFormProps {
    toolsQuery: string;
    onToolsQueryChange: (value: string) => void;
    withSectionFrame?: boolean;
}

const unique = (items: string[]) => [...new Set(items)];

export const RequiredToolsPickForm = observer(function RequiredToolsPickForm({
    toolsQuery,
    onToolsQueryChange,
    withSectionFrame = false,
}: RequiredToolsPickFormProps) {
    const generalData = profileStore.user?.generalData;

    const enabledTools = generalData?.enabledPromptTools ?? [];
    const requiredTools = generalData?.requiredPromptTools ?? [];

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

        profileStore.updateGeneralData({
            enabledPromptTools: toJS(nextEnabled),
            requiredPromptTools: toJS(nextRequired),
        });
    };

    const setRequiredTool = (toolName: string, checked: boolean) => {
        if (!generalData || !enabledTools.includes(toolName)) {
            return;
        }

        const nextRequired = checked
            ? unique([...requiredTools, toolName])
            : requiredTools.filter((item) => item !== toolName);

        profileStore.updateGeneralData({
            requiredPromptTools: toJS(nextRequired),
        });
    };

    return (
        <Wrapper
            className={
                withSectionFrame
                    ? "space-y-4 border-l-3 border-main-600 pl-3"
                    : "space-y-4"
            }
        >
            <p className="text-sm font-semibold text-main-100">
                Используемые инструменты
            </p>

            <InputSmall
                value={toolsQuery}
                onChange={(event) => onToolsQueryChange(event.target.value)}
                placeholder="Поиск по пакетам и инструментам"
            />

            <div className="rounded-xl border border-main-700/70 bg-main-900/50 p-3">
                <p className="text-sm font-semibold text-main-100">
                    Политика обязательного использования
                </p>
                <p className="mt-1 text-xs text-main-400">
                    Если включен хотя бы один инструмент, политика использования
                    будет автоматически добавлена в системный контекст
                    пользователя.
                </p>
                <p className="mt-2 text-xs text-main-300">
                    Включено: {enabledTools.length}. Обязательных:{" "}
                    {requiredTools.length}.
                </p>
            </div>

            {filteredPackages.length === 0 ? (
                <div className="rounded-xl border border-main-700/70 bg-main-900/45 p-4 text-sm text-main-400">
                    По вашему запросу ничего не найдено.
                </div>
            ) : (
                filteredPackages.map((pack) => (
                    <article
                        key={pack.id}
                        className="rounded-2xl bg-main-900/45 p-4"
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
                            {pack.tools.map((tool) => {
                                const isEnabled = enabledTools.includes(
                                    tool.name,
                                );
                                const isRequired = requiredTools.includes(
                                    tool.name,
                                );

                                return (
                                    <div
                                        key={`${pack.id}_${tool.name}`}
                                        className="flex items-start justify-between gap-3 rounded-xl border border-main-700/70 bg-main-900/60 p-3"
                                    >
                                        <div>
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

                                        <div className="flex min-w-44 flex-col items-end gap-2">
                                            <label className="flex items-center gap-2 text-xs text-main-300">
                                                <span>
                                                    {isEnabled
                                                        ? "Включен"
                                                        : "Выключен"}
                                                </span>
                                                <InputCheckbox
                                                    checked={isEnabled}
                                                    onChange={(checked) =>
                                                        setEnabledTool(
                                                            tool.name,
                                                            checked,
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label
                                                className={`flex items-center gap-2 text-xs ${
                                                    isEnabled
                                                        ? "text-main-300"
                                                        : "text-main-500"
                                                }`}
                                            >
                                                <span>
                                                    {isRequired
                                                        ? "Обязателен"
                                                        : "Не обязателен"}
                                                </span>
                                                <InputCheckbox
                                                    checked={isRequired}
                                                    disabled={!isEnabled}
                                                    onChange={(checked) =>
                                                        setRequiredTool(
                                                            tool.name,
                                                            checked,
                                                        )
                                                    }
                                                />
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
});
