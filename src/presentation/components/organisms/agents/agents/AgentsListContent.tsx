import { Icon } from "@iconify/react";
import { Button, Separator } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { AgentMock, AgentStatus } from "../mockData";

type AgentsListContentProps = {
    selectedAgent: AgentMock | null;
    isSubmitting: boolean;
    onToggleStatus: () => void;
    onCloneAgent: () => void;
    onDeleteAgent: () => void;
};

const statusStyles: Record<AgentStatus, string> = {
    active: "bg-emerald-500/20 text-emerald-300",
    paused: "bg-amber-500/20 text-amber-300",
    draft: "bg-main-600/60 text-main-300",
};

const statusLabels: Record<AgentStatus, string> = {
    active: "Активен",
    paused: "На паузе",
    draft: "Черновик",
};

const getStatusToggleLabel = (status: AgentStatus) => {
    if (status === "active") {
        return "Пауза";
    }

    return "Запустить";
};

export const AgentsListContent = ({
    selectedAgent,
    isSubmitting,
    onToggleStatus,
    onCloneAgent,
    onDeleteAgent,
}: AgentsListContentProps) => {
    if (!selectedAgent) {
        return (
            <div className="flex-1 p-4 animate-card-rise-in">
                <div className="flex h-full flex-col items-center justify-center gap-3">
                    <Icon
                        icon="mdi:robot-outline"
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

    return (
        <div className="flex-1 p-4 animate-card-rise-in">
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h3 className="text-base text-main-100">Профиль агента</h3>
                    <p className="text-xs text-main-400">
                        {selectedAgent.model} • обновлён{" "}
                        {selectedAgent.updatedAt}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        label={getStatusToggleLabel(selectedAgent.status)}
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-3"
                        disabled={isSubmitting}
                        onClick={onToggleStatus}
                    >
                        <Icon icon="mdi:play-outline" />
                    </Button>
                    <Button
                        label="Клонировать"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-3"
                        disabled={isSubmitting}
                        onClick={onCloneAgent}
                    >
                        <Icon icon="mdi:content-copy" />
                    </Button>
                    <Separator
                        orientation="vertical"
                        className="h-5 bg-main-400"
                    />
                    <Button
                        label="Удалить"
                        variant="danger"
                        shape="rounded-lg"
                        className="h-9 w-9 p-0"
                        disabled={isSubmitting}
                        onClick={onDeleteAgent}
                    >
                        <Icon icon="mdi:delete-outline" />
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h4 className="text-lg text-main-100">
                        {selectedAgent.name}
                    </h4>
                    <span
                        className={`rounded-md px-2 py-1 text-xs ${statusStyles[selectedAgent.status]}`}
                    >
                        {statusLabels[selectedAgent.status]}
                    </span>
                </div>

                <p className="text-sm text-main-300">{selectedAgent.role}</p>
                <p className="mt-3 text-sm text-main-200 leading-relaxed">
                    {selectedAgent.description}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-main-300">
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Модель: {selectedAgent.model}
                    </div>
                    <div className="rounded-xl bg-main-900/55 px-3 py-2">
                        Подключено инструментов: {selectedAgent.toolsCount}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {selectedAgent.tags.map((tag) => (
                        <span
                            key={`${selectedAgent.id}-${tag}`}
                            className="rounded-md border border-main-700/80 bg-main-900/70 px-2 py-1 text-xs text-main-300"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
