import { Icon } from "@iconify/react";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import {
    Button,
    InputBig,
    InputCheckSlided,
    InputSmall,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MsgToasts } from "../../../data/MsgToasts";
import { IconPicker } from "../../components/atoms";
import { agentsStore } from "../../../stores/agentsStore";
import { builtInToolPacks } from "../../../tools";

const DEFAULT_AGENT_ICON = "mdi:robot-outline";

export const AgentsCreatePage = () => {
    const navigate = useNavigate();
    const toast = useToasts();
    const [agentName, setAgentName] = useState("");
    const [chatLabel, setChatLabel] = useState("");
    const [chatIcon, setChatIcon] = useState(DEFAULT_AGENT_ICON);
    const [chatPlaceholder, setChatPlaceholder] = useState("");
    const [agentPrompt, setAgentPrompt] = useState("");
    const [agentToolsSet, setAgentToolsSet] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const allTools = useMemo(
        () => builtInToolPacks.flatMap((pack) => pack.tools),
        [],
    );

    const normalizedAgentName = agentName.trim();
    const normalizedPrompt = agentPrompt.trim();
    const isSubmitDisabled =
        isSubmitting || !normalizedAgentName || !normalizedPrompt;

    const setToolEnabled = (toolName: string, checked: boolean) => {
        setAgentToolsSet((current) => {
            if (checked) {
                return current.includes(toolName)
                    ? current
                    : [...current, toolName];
            }

            return current.filter((item) => item !== toolName);
        });
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitDisabled) {
            return;
        }

        setIsSubmitting(true);

        try {
            await agentsStore.addAgent({
                agentName: normalizedAgentName,
                agentPrompt: normalizedPrompt,
                agentToolsSet,
                chatLabel: chatLabel.trim() || normalizedAgentName,
                chatIcon,
                chatPlaceholder:
                    chatPlaceholder.trim() || "Поручите задачу агенту...",
            });
            toast.success(MsgToasts.AGENT_SUCCESSFULLY_CREATED());
            navigate("/agents");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-full w-full flex-col rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl text-main-100">
                            Создание агента
                        </h1>
                        <p className="mt-1 text-sm text-main-400">
                            Соберите роль, промпт и набор инструментов для
                            кастомного агента.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        shape="rounded-lg"
                        className="h-9 px-3 gap-2"
                        onClick={() => navigate("/agents")}
                    >
                        <Icon icon="mdi:arrow-left" />К списку
                    </Button>
                </div>
            </div>

            <form
                className="min-h-0 flex-1 overflow-y-auto p-4"
                onSubmit={handleSubmit}
            >
                <div className="grid grid-cols-[minmax(0,1fr)_24rem] gap-4">
                    <section className="space-y-4">
                        <div className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                            <h2 className="text-base text-main-100">
                                Основные данные
                            </h2>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <label className="space-y-2">
                                    <span className="text-sm text-main-200">
                                        Название
                                    </span>
                                    <InputSmall
                                        value={agentName}
                                        placeholder="Например, PR Reviewer"
                                        onChange={(event) =>
                                            setAgentName(event.target.value)
                                        }
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm text-main-200">
                                        Роль в чате
                                    </span>
                                    <InputSmall
                                        value={chatLabel}
                                        placeholder="Например, Ревью"
                                        onChange={(event) =>
                                            setChatLabel(event.target.value)
                                        }
                                    />
                                </label>
                            </div>

                            <label className="mt-3 block space-y-2">
                                <span className="text-sm text-main-200">
                                    Заполнитель
                                </span>
                                <InputSmall
                                    value={chatPlaceholder}
                                    placeholder="Что пользователь увидит в поле ввода"
                                    onChange={(event) =>
                                        setChatPlaceholder(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-base text-main-100">
                                    Системный промпт
                                </h2>
                                <span className="rounded-md bg-main-700/60 px-2 py-1 text-xs text-main-300">
                                    {agentPrompt.trim().length} символов
                                </span>
                            </div>
                            <InputBig
                                value={agentPrompt}
                                placeholder="Опишите роль агента, правила ответа, ограничения и критерии качества..."
                                className="mt-3 min-h-80 w-full rounded-xl border border-main-700/70 bg-main-950/35 p-3 text-main-100 placeholder:text-main-500"
                                onChange={(event) =>
                                    setAgentPrompt(event.target.value)
                                }
                            />
                        </div>

                        <div className="flex justify-end gap-2 rounded-2xl p-4">
                            <Button
                                type="button"
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-9 px-4"
                                onClick={() => navigate("/agents")}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                shape="rounded-lg"
                                className="h-9 px-2 gap-2"
                                disabled={isSubmitDisabled}
                            >
                                <Icon icon="mdi:content-save-outline" />
                                Создать агента
                            </Button>
                        </div>
                    </section>

                    <aside className="space-y-4">
                        <IconPicker value={chatIcon} onChange={setChatIcon} />

                        <section className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-base text-main-100">
                                    Инструменты
                                </h2>
                                <span className="rounded-md bg-main-700/60 px-2 py-1 text-xs text-main-300">
                                    {agentToolsSet.length}
                                </span>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                {allTools.map((tool) => {
                                    const isEnabled = agentToolsSet.includes(
                                        tool.name,
                                    );

                                    return (
                                        <details
                                            key={tool.name}
                                            className={`group rounded-lg border bg-main-900/50 transition-colors ${
                                                isEnabled
                                                    ? "border-main-600/70"
                                                    : "border-transparent hover:border-main-700/70"
                                            }`}
                                        >
                                            <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 px-2.5">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Icon
                                                        icon="mdi:chevron-right"
                                                        width={16}
                                                        height={16}
                                                        className="shrink-0 text-main-400 transition-transform group-open:rotate-90"
                                                    />
                                                    <span className="truncate text-sm text-main-100">
                                                        {tool.name}
                                                    </span>
                                                </span>
                                                <span
                                                    onClick={(event) =>
                                                        event.preventDefault()
                                                    }
                                                    className="flex shrink-0 items-center"
                                                >
                                                    <InputCheckSlided
                                                        checked={isEnabled}
                                                        onChange={(checked) =>
                                                            setToolEnabled(
                                                                tool.name,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                </span>
                                            </summary>
                                            <p className="border-t border-main-700/50 px-9 py-2 text-xs leading-relaxed text-main-400">
                                                {tool.description ||
                                                    "Без описания"}
                                            </p>
                                        </details>
                                    );
                                })}
                            </div>
                        </section>
                    </aside>
                </div>
            </form>
        </div>
    );
};
