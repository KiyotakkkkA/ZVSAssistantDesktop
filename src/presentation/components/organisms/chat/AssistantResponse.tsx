import { Icon } from "@iconify/react";
import {
    ChatAssistantBubbleCard,
    ChatThinkingBubbleCard,
    PlanningToolBubbleCard,
    QaToolBubbleCard,
    ToolBubbleCard,
} from "../../molecules/chat/cards";
import type { AssistantMessageStage } from "../../../../../electron/models/dialog";
import type { ToolTrace } from "../../../../../electron/models/tool";
import type { QaToolState } from "../../../../utils/tools/qaTool";

type AssistantResponseProps = {
    messageId: string;
    content: string;
    reasoning?: string;
    timestamp?: string;
    isStreaming?: boolean;
    isError?: boolean;
    stages?: AssistantMessageStage[];
    toolTraces?: ToolTrace[];
    onSelectAskQuestion?: (
        messageId: string,
        toolCallId: string,
        questionIndex: number,
    ) => void;
    onSaveAskAnswer?: (
        messageId: string,
        toolCallId: string,
        questionIndex: number,
        answer: string,
    ) => void;
    onSendAskAnswers?: (
        messageId: string,
        toolCallId: string,
        qaState: QaToolState,
    ) => void;
};

export const AssistantResponse = ({
    messageId,
    content,
    reasoning = "",
    timestamp,
    isStreaming = false,
    isError = false,
    stages = [],
    toolTraces = [],
    onSelectAskQuestion,
    onSaveAskAnswer,
    onSendAskAnswers,
}: AssistantResponseProps) => {
    const planningTraces = toolTraces.filter(
        (trace) => trace.toolName === "planning_tool",
    );
    const tracesByCallId = new Map(
        toolTraces.map((trace) => [trace.callId, trace]),
    );

    const buildLegacyStages = (): AssistantMessageStage[] => {
        const legacyStages: AssistantMessageStage[] = [];

        for (const trace of toolTraces) {
            legacyStages.push({
                id: `stg-legacy-tool-${trace.callId}` as `stg-${string}`,
                type: "tool",
                toolCallId: trace.callId,
            });
        }

        if (reasoning.trim()) {
            legacyStages.push({
                id: "stg-legacy-reasoning" as `stg-${string}`,
                type: "reasoning",
                content: reasoning,
            });
        }

        if (content.trim() || isStreaming || isError) {
            legacyStages.push({
                id: "stg-legacy-answer" as `stg-${string}`,
                type: "answer",
                content,
            });
        }

        return legacyStages;
    };

    const orderedStages = stages.length > 0 ? stages : buildLegacyStages();
    const lastAnswerStageIndex = [...orderedStages]
        .map((stage) => stage.type)
        .lastIndexOf("answer");

    let planningRendered = false;

    return (
        <article className="flex justify-start">
            <div className="relative w-full max-w-[72%] pl-9">
                <div className="pointer-events-none absolute bottom-4 left-3.5 top-3 w-px bg-main-700/70" />

                <div className="space-y-2">
                    {orderedStages.map((stage, index) => {
                        if (stage.type === "reasoning") {
                            return (
                                <div
                                    key={stage.id}
                                    className="relative grid grid-cols-[auto_1fr] items-start gap-3"
                                >
                                    <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                        <Icon
                                            icon="mdi:head-lightbulb-outline"
                                            width={12}
                                            height={12}
                                            className="text-main-300"
                                        />
                                    </span>

                                    <ChatThinkingBubbleCard
                                        content={stage.content}
                                        isLoading={isStreaming}
                                    />
                                </div>
                            );
                        }

                        if (stage.type === "answer") {
                            return (
                                <div
                                    key={stage.id}
                                    className="relative grid grid-cols-[auto_1fr] items-start gap-3"
                                >
                                    <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                        <Icon
                                            icon="mdi:message-text-outline"
                                            width={12}
                                            height={12}
                                            className="text-main-300"
                                        />
                                    </span>

                                    <ChatAssistantBubbleCard
                                        content={stage.content}
                                        timestamp={
                                            index === lastAnswerStageIndex
                                                ? timestamp
                                                : undefined
                                        }
                                        isStreaming={isStreaming}
                                        isError={isError}
                                    />
                                </div>
                            );
                        }

                        const trace = tracesByCallId.get(stage.toolCallId);

                        if (!trace) {
                            return null;
                        }

                        if (trace.toolName === "planning_tool") {
                            if (planningRendered) {
                                return null;
                            }

                            planningRendered = true;

                            return (
                                <div
                                    key={stage.id}
                                    className="relative grid grid-cols-[auto_1fr] items-start gap-3"
                                >
                                    <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                        <Icon
                                            icon="mdi:clipboard-text-outline"
                                            width={12}
                                            height={12}
                                            className="text-main-300"
                                        />
                                    </span>

                                    <PlanningToolBubbleCard
                                        traces={planningTraces}
                                        isLoading={isStreaming}
                                    />
                                </div>
                            );
                        }

                        if (trace.toolName === "ask_tool") {
                            const answered =
                                trace.status === "done" ||
                                (trace.result &&
                                    typeof trace.result === "object" &&
                                    "answered" in trace.result &&
                                    trace.result.answered === true);

                            return (
                                <div
                                    key={stage.id}
                                    className="relative grid grid-cols-[auto_1fr] items-start gap-3"
                                >
                                    <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                        <Icon
                                            icon="mdi:help-circle-outline"
                                            width={12}
                                            height={12}
                                            className="text-main-300"
                                        />
                                    </span>

                                    <QaToolBubbleCard
                                        toolTrace={trace}
                                        answered={Boolean(answered)}
                                        onSelectQuestion={(questionIndex) => {
                                            onSelectAskQuestion?.(
                                                messageId,
                                                trace.callId,
                                                questionIndex,
                                            );
                                        }}
                                        onSaveAnswer={(
                                            questionIndex,
                                            answer,
                                        ) => {
                                            onSaveAskAnswer?.(
                                                messageId,
                                                trace.callId,
                                                questionIndex,
                                                answer,
                                            );
                                        }}
                                        onSendAnswers={(qaState) => {
                                            onSendAskAnswers?.(
                                                messageId,
                                                trace.callId,
                                                qaState,
                                            );
                                        }}
                                    />
                                </div>
                            );
                        }

                        return (
                            <div
                                key={stage.id}
                                className="relative grid grid-cols-[auto_1fr] items-start gap-3"
                            >
                                <span className="absolute -left-7.5 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-main-900 ring-1 ring-main-600/80">
                                    <Icon
                                        icon="mdi:wrench-outline"
                                        width={12}
                                        height={12}
                                        className="text-main-300"
                                    />
                                </span>

                                <ToolBubbleCard
                                    toolTrace={trace}
                                    isLoading={isStreaming}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </article>
    );
};
