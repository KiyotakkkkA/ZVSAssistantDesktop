import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, InputBig, SlidedPanel } from "../../../atoms";
import { useScenarioBuilderChat } from "../../../../../hooks/agents";
import { ScenarioBuilderMessageFeed } from "./ScenarioBuilderMessageFeed";

export function ScenarioAiChatPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const {
        messages,
        isStreaming,
        activeStage,
        activeResponseToId,
        sendMessage,
        clearChat,
        approveCommandExec,
        rejectCommandExec,
        interruptCommandExec,
    } = useScenarioBuilderChat();

    const canSend = useMemo(
        () => draft.trim().length > 0 && !isStreaming,
        [draft, isStreaming],
    );

    const onSend = () => {
        const content = draft.trim();
        if (!content || isStreaming) {
            return;
        }

        sendMessage(content);
        setDraft("");
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-30">
            {!isOpen ? (
                <Button
                    className="pointer-events-auto absolute bottom-4 right-4 group flex items-center gap-2 rounded-full bg-main-800/95 hover:bg-main-700/95 px-4 py-2 text-sm text-main-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5"
                    onClick={() => setIsOpen(true)}
                >
                    <span className="rounded-full bg-main-300/15 p-1.5 text-main-200 transition-colors group-hover:bg-main-300/25">
                        <Icon icon="mdi:sparkles" width={16} height={16} />
                    </span>
                    <span>AI Генерация</span>
                </Button>
            ) : null}

            <SlidedPanel
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="AI помощник схемы"
                subtitle="Дизайн-режим, без выполнения"
                modalMode
                widthClassName="w-300 max-w-[95vw]"
                bodyClassName="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
            >
                {messages.length === 0 ? (
                    <div className="rounded-xl border border-main-700/60 bg-main-800/45 px-3 py-2 text-xs text-main-300">
                        Напишите задачу, и я соберу или изменю схему через
                        scenario_builder_tool.
                    </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-hidden">
                    <ScenarioBuilderMessageFeed
                        messages={messages}
                        activeStage={activeStage}
                        activeResponseToId={activeResponseToId}
                        onApproveCommandExec={approveCommandExec}
                        onRejectCommandExec={rejectCommandExec}
                        onInterruptCommandExec={interruptCommandExec}
                    />
                </div>

                <footer className="shrink-0 rounded-2xl bg-main-900 ring-main-300/20">
                    <div className="mx-auto w-full rounded-[1.35rem] border border-main-700/80 bg-main-800 p-3">
                        <div className="relative rounded-2xl bg-main-900 px-3 py-2">
                            <InputBig
                                value={draft}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                placeholder="Опишите, какую схему хотите собрать..."
                                className="h-auto! min-h-9 w-full rounded-lg border-0 bg-transparent p-2 text-main-100 placeholder:text-main-400"
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" &&
                                        !event.shiftKey
                                    ) {
                                        event.preventDefault();
                                        onSend();
                                    }
                                }}
                            />

                            <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    className="text-[11px] text-main-500 transition-colors hover:text-main-300"
                                    onClick={clearChat}
                                    disabled={isStreaming}
                                >
                                    Очистить диалог
                                </button>

                                <Button
                                    variant="primary"
                                    shape="rounded-lg"
                                    className="h-9 gap-1 px-3 text-xs"
                                    disabled={!canSend}
                                    onClick={onSend}
                                >
                                    <Icon
                                        icon="mdi:send"
                                        width={14}
                                        height={14}
                                    />
                                    Отправить
                                </Button>
                            </div>
                        </div>
                    </div>
                </footer>
            </SlidedPanel>
        </div>
    );
}
