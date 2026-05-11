import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import type { Agent } from "../../../../../../electron/models/agent";
import { getBaseModelKeyById } from "../../../../../data/BaseModels";
import { profileStore } from "../../../../../stores/profileStore";
import { workspaceStore } from "../../../../../stores/workspaceStore";
import { builtInToolPacks } from "../../../../../tools";

type AgentsListContentProps = {
    selectedAgent: Agent | null;
};

const toolByName = new Map(
    builtInToolPacks.flatMap((pack) =>
        pack.tools.map((tool) => [tool.name, tool] as const),
    ),
);

const promptPreview = (prompt: string) => {
    const normalized = prompt.trim();

    if (normalized.length <= 820) {
        return normalized;
    }

    return `${normalized.slice(0, 820).trim()}...`;
};

export const AgentsListContent = observer(
    ({ selectedAgent }: AgentsListContentProps) => {
        if (!selectedAgent) {
            return (
                <div className="flex-1 p-4 animate-card-rise-in">
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:robot-off-outline"
                            width={64}
                            height={64}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            Выберите агента слева
                        </p>
                    </div>
                </div>
            );
        }

        const modeKey = getBaseModelKeyById(selectedAgent.id);
        const enabledTools =
            profileStore.user?.generalData.enabledPromptTools ?? [];
        const requiredTools =
            profileStore.user?.generalData.requiredPromptTools ?? [];
        const displayToolNames =
            modeKey === "agent" ? enabledTools : selectedAgent.agentToolsSet;
        const isActive =
            profileStore.user?.generalData.selectedAssistantMode === modeKey;

        const handleUseInChat = () => {
            profileStore.updateGeneralData({ selectedAssistantMode: modeKey });
            workspaceStore.setSelectedAssistantMode(modeKey);
        };

        return (
            <div className="flex-1 min-w-0 overflow-y-auto p-4 animate-card-rise-in">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-main-700/80 p-3 text-main-100">
                                <Icon
                                    icon={selectedAgent.chatIcon}
                                    width={24}
                                    height={24}
                                />
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate text-xl text-main-100">
                                    {selectedAgent.agentName}
                                </h3>
                                <p className="text-sm text-main-400">
                                    {selectedAgent.chatPlaceholder}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            label={isActive ? "Выбран" : "Выбрать в чат"}
                            variant={isActive ? "success" : "primary"}
                            shape="rounded-lg"
                            className="h-9 px-3"
                            disabled={isActive}
                            onClick={handleUseInChat}
                        >
                            <Icon icon="mdi:check-circle-outline" />
                        </Button>
                        <Button
                            label="Копия"
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-3"
                            disabled={!selectedAgent.isEditable}
                        >
                            <Icon icon="mdi:content-copy" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <section className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                        <p className="text-xs text-main-400">Роль в чате</p>
                        <p className="mt-2 text-lg text-main-100">
                            {selectedAgent.chatLabel}
                        </p>
                    </section>
                    <section className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                        <p className="text-xs text-main-400">Включено</p>
                        <p className="mt-2 text-lg text-main-100">
                            {displayToolNames.length}
                        </p>
                    </section>
                    <section className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                        <p className="text-xs text-main-400">Редактирование</p>
                        <p className="mt-2 text-lg text-main-100">
                            {selectedAgent.isEditable
                                ? "Доступно"
                                : "Системный"}
                        </p>
                    </section>
                </div>

                <section className="mt-4 rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="text-base text-main-100">
                            Системный промпт
                        </h4>
                        <span className="rounded-md bg-main-700/60 px-2 py-1 text-xs text-main-300">
                            {selectedAgent.agentPrompt.length} символов
                        </span>
                    </div>
                    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-main-950/45 p-3 text-xs leading-relaxed text-main-300">
                        {promptPreview(selectedAgent.agentPrompt)}
                    </pre>
                </section>

                <section className="mt-4 rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-base text-main-100">
                            Набор инструментов
                        </h4>
                        {modeKey === "agent" ? (
                            <span className="rounded-md bg-main-700/60 px-2 py-1 text-xs text-main-300">
                                Текущая конфигурация
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {displayToolNames.length > 0 ? (
                            displayToolNames.map((toolName) => {
                                const tool = toolByName.get(toolName);
                                const isRequired =
                                    requiredTools.includes(toolName);

                                return (
                                    <span
                                        key={toolName}
                                        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-main-700/80 bg-main-900/70 px-3 py-2 text-xs text-main-300"
                                        title={tool?.description}
                                    >
                                        <Icon
                                            icon="mdi:toolbox-outline"
                                            width={14}
                                            height={14}
                                        />
                                        <span className="font-semibold text-main-100">
                                            {toolName}
                                        </span>
                                        {isRequired ? (
                                            <span className="rounded-md bg-main-700/70 px-1.5 py-0.5 text-[10px] text-main-300">
                                                обязателен
                                            </span>
                                        ) : null}
                                    </span>
                                );
                            })
                        ) : (
                            <span className="text-sm text-main-400">
                                Инструменты не включены.
                            </span>
                        )}
                    </div>
                </section>
            </div>
        );
    },
);
