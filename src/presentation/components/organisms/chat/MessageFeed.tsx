import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import { Avatar, Button, Loader, Modal } from "../../atoms";
import {
    ChatUserBubbleCard,
    PlanningToolBubbleCard,
    QaToolBubbleCard,
    ThinkingBubbleCard,
    ToolBubbleCard,
} from "../../molecules/cards/chat";
import { MarkdownStaticContent } from "../../molecules/render";
import type {
    AssistantStage,
    ChatMessage,
    QaToolState,
    ToolTrace,
} from "../../../../types/Chat";
import { useMessages } from "../../../../hooks";

interface MessageFeedProps {
    messages: ChatMessage[];
    sendMessage: (content: string) => void;
    showLoader?: boolean;
    activeStage?: AssistantStage | null;
    activeResponseToId?: string | null;
    contextKey?: string;
}

type AssistantStageBlock = {
    stage: AssistantStage;
    messages: ChatMessage[];
};

const normalizeAssistantStage = (stage?: AssistantStage): AssistantStage => {
    if (!stage) {
        return "answering";
    }

    return stage;
};

const buildAssistantStageBlocks = (
    stages: ChatMessage[],
): AssistantStageBlock[] => {
    return stages.reduce<AssistantStageBlock[]>((accumulator, message) => {
        const stage = normalizeAssistantStage(message.assistantStage);
        const lastBlock = accumulator[accumulator.length - 1];

        if (!lastBlock || lastBlock.stage !== stage) {
            accumulator.push({ stage, messages: [message] });
            return accumulator;
        }

        lastBlock.messages.push(message);
        return accumulator;
    }, []);
};

const buildStageLineIcon = ({
    isStageActive,
    icon,
}: {
    isStageActive: boolean;
    icon: string;
}) => {
    return (
        <span
            className={`absolute -left-5.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-main-900 ${
                isStageActive ? "shadow-[0_0_0_2px_rgba(255,255,255,0.08)]" : ""
            }`}
        >
            <Icon
                icon={icon}
                width={12}
                height={12}
                className="text-indigo-300"
            />
        </span>
    );
};

function AssistantResponseBlock({
    stages,
    saveQaAnswer,
    sendQaAnswer,
    setQaActiveQuestion,
    onApproveCommandExec,
    onRejectCommandExec,
    onInterruptCommandExec,
    activeStage,
    isActive,
}: {
    stages: ChatMessage[];
    saveQaAnswer: (
        qaMessageId: string,
        questionIndex: number,
        answer: string,
    ) => void;
    sendQaAnswer: (qaMessageId: string, qaState?: QaToolState) => void;
    setQaActiveQuestion: (qaMessageId: string, questionIndex: number) => void;
    onApproveCommandExec: (messageId: string) => void;
    onRejectCommandExec: (messageId: string) => void;
    onInterruptCommandExec: (messageId: string) => void;
    activeStage?: AssistantStage | null;
    isActive?: boolean;
}) {
    const stageBlocks = buildAssistantStageBlocks(stages);
    const normalizedActiveStage = isActive && activeStage ? activeStage : null;

    const activeBlockIndex =
        normalizedActiveStage === null
            ? -1
            : stageBlocks
                  .map((block) => block.stage)
                  .lastIndexOf(normalizedActiveStage);

    const hasActiveBlock = activeBlockIndex !== -1;

    const stageLoaderTitles: Record<AssistantStage, string> = {
        thinking: "Думаю...",
        planning: "Строю план...",
        questioning: "Формулирую уточнение...",
        tools_calling: "Вызываю инструменты...",
        answering: "Генерирую ответ...",
    };

    const stageMeta: Record<AssistantStage, { label: string; icon: string }> = {
        thinking: {
            label: "Этап: Размышления",
            icon: "mdi:head-lightbulb-outline",
        },
        planning: {
            label: "Этап: Планирование",
            icon: "mdi:clipboard-text-outline",
        },
        questioning: {
            label: "Этап: Уточнение",
            icon: "mdi:chat-question-outline",
        },
        tools_calling: {
            label: "Этап: Вызов инструментов",
            icon: "mdi:tools",
        },
        answering: {
            label: "Этап: Ответ",
            icon: "mdi:message-text-outline",
        },
    };

    if (!stageBlocks.length && !normalizedActiveStage) {
        return null;
    }

    return (
        <article className="flex gap-3 justify-start">
            <Avatar label="AI" tone="assistant" />
            <div className="w-full max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-main-100">
                <div className="relative space-y-3 pl-5">
                    <div className="pointer-events-none absolute left-1.5 top-1 bottom-1 w-px bg-main-700/70" />
                    {stageBlocks.map((block, blockIndex) => {
                        const stageBlockKey = `${block.stage}_${block.messages[0]?.id || blockIndex}`;
                        const stageKey = normalizeAssistantStage(block.stage);
                        const isStageActive =
                            normalizedActiveStage === stageKey &&
                            activeBlockIndex === blockIndex;

                        if (block.stage === "thinking") {
                            return (
                                <div key={stageBlockKey} className="relative">
                                    {buildStageLineIcon({
                                        isStageActive,
                                        icon: stageMeta[stageKey].icon,
                                    })}
                                    <div className="mb-1 flex items-center gap-2 text-[11px] text-main-300">
                                        <span>{stageMeta[stageKey].label}</span>
                                        <span className="text-main-500">•</span>
                                        <span>
                                            {blockIndex + 1}/
                                            {stageBlocks.length}
                                        </span>
                                    </div>
                                    <div>
                                        <ThinkingBubbleCard
                                            content={block.messages
                                                .map(
                                                    (message) =>
                                                        message.content,
                                                )
                                                .join("\n")}
                                            isLoading={isStageActive}
                                        />
                                    </div>
                                </div>
                            );
                        }

                        if (
                            block.stage === "planning" ||
                            block.stage === "questioning" ||
                            block.stage === "tools_calling"
                        ) {
                            const isToolBlockLoading =
                                (normalizedActiveStage === "planning" ||
                                    normalizedActiveStage === "questioning" ||
                                    normalizedActiveStage ===
                                        "tools_calling") &&
                                activeBlockIndex === blockIndex;

                            const renderedItems: JSX.Element[] = [];

                            for (
                                let toolIndex = 0;
                                toolIndex < block.messages.length;
                                toolIndex += 1
                            ) {
                                const message = block.messages[toolIndex];
                                const toolName = message.toolTrace?.toolName;

                                if (toolName === "planning_tool") {
                                    const planningMessages = [message];
                                    let nextIndex = toolIndex + 1;

                                    while (nextIndex < block.messages.length) {
                                        const nextMessage =
                                            block.messages[nextIndex];
                                        if (
                                            nextMessage.toolTrace?.toolName !==
                                            "planning_tool"
                                        ) {
                                            break;
                                        }

                                        planningMessages.push(nextMessage);
                                        nextIndex += 1;
                                    }

                                    renderedItems.push(
                                        <PlanningToolBubbleCard
                                            key={planningMessages[0].id}
                                            traces={planningMessages
                                                .map((item) => item.toolTrace)
                                                .filter(
                                                    (
                                                        trace,
                                                    ): trace is ToolTrace =>
                                                        Boolean(trace),
                                                )}
                                            isLoading={
                                                isToolBlockLoading &&
                                                nextIndex ===
                                                    block.messages.length
                                            }
                                        />,
                                    );

                                    toolIndex = nextIndex - 1;
                                    continue;
                                }

                                renderedItems.push(
                                    toolName === "qa_tool" ? (
                                        <QaToolBubbleCard
                                            key={message.id}
                                            toolTrace={message.toolTrace}
                                            answered={
                                                message.toolTrace?.status ===
                                                "answered"
                                            }
                                            onSelectQuestion={(questionIndex) =>
                                                setQaActiveQuestion(
                                                    message.id,
                                                    questionIndex,
                                                )
                                            }
                                            onSaveAnswer={(
                                                questionIndex,
                                                answer,
                                            ) =>
                                                saveQaAnswer(
                                                    message.id,
                                                    questionIndex,
                                                    answer,
                                                )
                                            }
                                            onSendAnswers={(qaState) =>
                                                sendQaAnswer(
                                                    message.id,
                                                    qaState,
                                                )
                                            }
                                        />
                                    ) : (
                                        <ToolBubbleCard
                                            key={message.id}
                                            content={message.content}
                                            toolTrace={message.toolTrace}
                                            onApproveCommandExec={() =>
                                                onApproveCommandExec(message.id)
                                            }
                                            onRejectCommandExec={() =>
                                                onRejectCommandExec(message.id)
                                            }
                                            onInterruptCommandExec={() =>
                                                onInterruptCommandExec(
                                                    message.id,
                                                )
                                            }
                                            isLoading={
                                                isToolBlockLoading &&
                                                toolIndex ===
                                                    block.messages.length - 1
                                            }
                                        />
                                    ),
                                );
                            }

                            if (renderedItems.length === 0) {
                                return null;
                            }

                            return (
                                <div key={stageBlockKey} className="relative">
                                    {buildStageLineIcon({
                                        isStageActive,
                                        icon: stageMeta[stageKey].icon,
                                    })}
                                    <div className="mb-1 flex items-center gap-2 text-[11px] text-main-300">
                                        <span>{stageMeta[stageKey].label}</span>
                                        <span className="text-main-500">•</span>
                                        <span>
                                            {blockIndex + 1}/
                                            {stageBlocks.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {renderedItems}
                                    </div>
                                </div>
                            );
                        }

                        const combinedAnswer = block.messages
                            .map((message) => message.content)
                            .join("");
                        const answerTimestamp =
                            block.messages[block.messages.length - 1]
                                ?.timestamp;

                        return (
                            <div key={stageBlockKey} className="relative">
                                {buildStageLineIcon({
                                    isStageActive,
                                    icon: stageMeta[stageKey].icon,
                                })}
                                <div className="mb-1 flex items-center gap-2 text-[11px] text-main-300">
                                    <span>{stageMeta[stageKey].label}</span>
                                    <span className="text-main-500">•</span>
                                    <span>
                                        {blockIndex + 1}/{stageBlocks.length}
                                    </span>
                                </div>
                                <div>
                                    <MarkdownStaticContent
                                        content={combinedAnswer}
                                    />
                                    {isStageActive && (
                                        <div className="mt-2 flex items-center gap-2 text-[11px] text-main-400">
                                            <Loader className="h-3.5 w-3.5" />
                                            <span>Генерирую ответ...</span>
                                        </div>
                                    )}
                                    <p className="mt-2 text-[11px] text-main-400">
                                        {answerTimestamp}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    {normalizedActiveStage && !hasActiveBlock && (
                        <div className="relative">
                            <span className="absolute -left-5.5  top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-main-500 bg-main-900 shadow-[0_0_0_2px_rgba(255,255,255,0.08)]">
                                <Icon
                                    icon={stageMeta[normalizedActiveStage].icon}
                                    width={10}
                                    height={10}
                                    className="text-main-300"
                                />
                            </span>
                            <div className="flex items-center gap-2 rounded-xl border border-main-700/60 bg-main-900/50 px-3 py-2 text-xs text-main-300">
                                <Loader className="h-3.5 w-3.5" />
                                <span>
                                    {stageLoaderTitles[normalizedActiveStage]}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

export function MessageFeed({
    messages,
    sendMessage,
    showLoader = false,
    activeStage = null,
    activeResponseToId = null,
    contextKey,
}: MessageFeedProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const previousLastMessageIdRef = useRef<string | null>(null);
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const didInitialScrollRef = useRef(false);
    const linkedStagesByUserId = useMemo(() => {
        const userMessageIds = new Set(
            messages
                .filter((message) => message.author === "user")
                .map((message) => message.id),
        );
        const grouped = new Map<string, ChatMessage[]>();

        messages.forEach((message) => {
            if (
                message.author !== "assistant" ||
                !message.answeringAt ||
                !userMessageIds.has(message.answeringAt)
            ) {
                return;
            }

            const linkedStages = grouped.get(message.answeringAt) || [];
            linkedStages.push(message);
            grouped.set(message.answeringAt, linkedStages);
        });

        return grouped;
    }, [messages]);
    const {
        editingMessageId,
        editingValue,
        setEditingValue,
        startEdit,
        cancelEdit,
        submitEdit,
        retryMessage,
        copyMessage,
        deleteMessageId,
        requestDeleteMessage,
        cancelDeleteMessage,
        confirmDeleteMessage,
        approveCommandExec,
        rejectCommandExec,
        interruptCommandExec,
        saveQaAnswer,
        setQaActiveQuestion,
        sendQaAnswer,
    } = useMessages({ sendMessage });

    useEffect(() => {
        previousLastMessageIdRef.current = null;
        didInitialScrollRef.current = false;
    }, [contextKey]);

    useLayoutEffect(() => {
        if (didInitialScrollRef.current) {
            return;
        }

        const container = scrollContainerRef.current;
        if (!container || messages.length === 0) {
            return;
        }

        container.scrollTop = container.scrollHeight;
        didInitialScrollRef.current = true;
    }, [contextKey, messages]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage) {
            previousLastMessageIdRef.current = null;
            return;
        }

        const previousLastMessageId = previousLastMessageIdRef.current;
        const isNewLastMessage = previousLastMessageId !== lastMessage.id;
        const shouldSmoothScroll =
            previousLastMessageId !== null &&
            isNewLastMessage &&
            lastMessage.author === "user";

        const shouldStickToBottomWhileStreaming =
            Boolean(activeResponseToId) &&
            lastMessage.author === "assistant" &&
            lastMessage.answeringAt === activeResponseToId;

        if (
            (shouldSmoothScroll || shouldStickToBottomWhileStreaming) &&
            scrollContainerRef.current
        ) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: shouldSmoothScroll ? "smooth" : "auto",
            });
        }

        previousLastMessageIdRef.current = lastMessage.id;
    }, [activeResponseToId, messages]);

    return (
        <>
            <section
                ref={scrollContainerRef}
                className="flex-1 space-y-4 overflow-y-auto rounded-2xl bg-main-900/55 p-2 ring-main-300/15"
            >
                {(() => {
                    const consumedMessageIds = new Set<string>();

                    return messages.map((message) => {
                        if (consumedMessageIds.has(message.id)) {
                            return null;
                        }

                        if (message.author === "user") {
                            const linkedStages =
                                linkedStagesByUserId.get(message.id) || [];
                            const isActiveResponse =
                                activeResponseToId === message.id;

                            linkedStages.forEach((item) =>
                                consumedMessageIds.add(item.id),
                            );

                            return (
                                <div key={message.id} className="space-y-3">
                                    <ChatUserBubbleCard
                                        content={message.content}
                                        timestamp={message.timestamp}
                                        isEditing={
                                            editingMessageId === message.id
                                        }
                                        editValue={
                                            editingMessageId === message.id
                                                ? editingValue
                                                : message.content
                                        }
                                        onEditValueChange={setEditingValue}
                                        onEditConfirm={() => {
                                            void submitEdit();
                                        }}
                                        onEditCancel={cancelEdit}
                                        msgDelete={() =>
                                            requestDeleteMessage(message.id)
                                        }
                                        msgEdit={() =>
                                            startEdit(
                                                message.id,
                                                message.content,
                                            )
                                        }
                                        msgCopy={() => {
                                            void copyMessage(message.content);
                                        }}
                                        msgRetry={() => {
                                            void retryMessage(
                                                message.id,
                                                message.content,
                                            );
                                        }}
                                    />

                                    {(linkedStages.length > 0 ||
                                        isActiveResponse) && (
                                        <AssistantResponseBlock
                                            stages={linkedStages}
                                            saveQaAnswer={saveQaAnswer}
                                            sendQaAnswer={sendQaAnswer}
                                            setQaActiveQuestion={
                                                setQaActiveQuestion
                                            }
                                            onApproveCommandExec={
                                                approveCommandExec
                                            }
                                            onRejectCommandExec={
                                                rejectCommandExec
                                            }
                                            onInterruptCommandExec={
                                                interruptCommandExec
                                            }
                                            activeStage={activeStage}
                                            isActive={isActiveResponse}
                                        />
                                    )}
                                </div>
                            );
                        }

                        if (
                            message.author === "assistant" &&
                            (!message.answeringAt ||
                                !messages.some(
                                    (m) => m.id === message.answeringAt,
                                ))
                        ) {
                            return (
                                <div key={message.id}>
                                    <AssistantResponseBlock
                                        stages={[message]}
                                        saveQaAnswer={saveQaAnswer}
                                        sendQaAnswer={sendQaAnswer}
                                        setQaActiveQuestion={
                                            setQaActiveQuestion
                                        }
                                        onApproveCommandExec={
                                            approveCommandExec
                                        }
                                        onRejectCommandExec={rejectCommandExec}
                                        onInterruptCommandExec={
                                            interruptCommandExec
                                        }
                                        activeStage={null}
                                        isActive={false}
                                    />
                                </div>
                            );
                        }

                        return null;
                    });
                })()}
                {showLoader && !activeResponseToId && (
                    <div className="flex items-center gap-2 px-2 text-sm text-main-400">
                        <Loader />
                        <span>Модель печатает...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </section>

            <Modal
                open={Boolean(deleteMessageId)}
                onClose={cancelDeleteMessage}
                title="Удаление сообщения"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={cancelDeleteMessage}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => {
                                void confirmDeleteMessage();
                            }}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Вы уверены, что хотите удалить это сообщение?
                </p>
            </Modal>
        </>
    );
}
