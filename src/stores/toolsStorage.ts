import type { AskToolResult, ToolTrace } from "../../electron/models/tool";
import type { DialogUiMessage } from "../../electron/models/dialog";

type ToolCallPart = {
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
    args?: unknown;
};

type ToolResultPart = {
    toolCallId?: string;
    toolName?: string;
    output?: unknown;
    result?: unknown;
    errorText?: string;
};

const nowIso = () => new Date().toISOString();
const createStageId = (): `stg-${string}` =>
    `stg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneMessages = (messages: DialogUiMessage[]) => [...messages];

const getLastAssistantIndex = (messages: DialogUiMessage[]) => {
    return messages.map((message) => message.role).lastIndexOf("assistant");
};

const ensureToolStage = (
    message: DialogUiMessage,
    toolCallId: string,
    toolName: string,
) => {
    const stages = message.stages ?? [];

    if (toolName === "planning_tool") {
        const hasPlanningStage = stages.some(
            (stage) =>
                stage.type === "tool" &&
                (message.toolTraces ?? []).some(
                    (trace) =>
                        trace.callId === stage.toolCallId &&
                        trace.toolName === "planning_tool",
                ),
        );

        if (hasPlanningStage) {
            return stages;
        }
    }

    const alreadyExists = stages.some(
        (stage) => stage.type === "tool" && stage.toolCallId === toolCallId,
    );

    if (alreadyExists) {
        return stages;
    }

    return [
        ...stages,
        {
            id: createStageId(),
            type: "tool" as const,
            toolCallId,
        },
    ];
};

const upsertTrace = (
    traces: ToolTrace[],
    nextTrace: ToolTrace,
): ToolTrace[] => {
    const existingIndex = traces.findIndex(
        (trace) => trace.callId === nextTrace.callId,
    );

    if (existingIndex < 0) {
        return [...traces, nextTrace];
    }

    const next = [...traces];
    next[existingIndex] = {
        ...next[existingIndex],
        ...nextTrace,
        createdAt: next[existingIndex].createdAt,
        updatedAt: nowIso(),
    };

    return next;
};

const findAskTrace = (message: DialogUiMessage, callId: string) => {
    const traces = message.toolTraces ?? [];

    return traces.find(
        (trace) => trace.callId === callId && trace.toolName === "ask_tool",
    );
};

const updateAskResult = (
    result: unknown,
    updater: (payload: AskToolResult) => AskToolResult,
) => {
    if (!result || typeof result !== "object") {
        return result;
    }

    const payload = result as AskToolResult;

    if (!Array.isArray(payload.questions)) {
        return result;
    }

    return updater(payload);
};

class ToolsStorage {
    applyToolCall(messages: DialogUiMessage[], part: ToolCallPart) {
        const toolCallId =
            typeof part.toolCallId === "string" ? part.toolCallId : null;
        const toolName =
            typeof part.toolName === "string" ? part.toolName : null;

        if (!toolCallId || !toolName) {
            return messages;
        }

        const nextMessages = cloneMessages(messages);
        const assistantIndex = getLastAssistantIndex(nextMessages);

        if (assistantIndex < 0) {
            return messages;
        }

        const assistantMessage = nextMessages[assistantIndex];

        const trace: ToolTrace = {
            callId: toolCallId,
            toolName,
            status: "running",
            args: part.input ?? part.args ?? {},
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };

        nextMessages[assistantIndex] = {
            ...assistantMessage,
            toolTraces: upsertTrace(assistantMessage.toolTraces ?? [], trace),
            stages: ensureToolStage(assistantMessage, toolCallId, toolName),
        };

        return nextMessages;
    }

    applyToolResult(messages: DialogUiMessage[], part: ToolResultPart) {
        const toolCallId =
            typeof part.toolCallId === "string" ? part.toolCallId : null;
        const toolName =
            typeof part.toolName === "string" ? part.toolName : null;

        if (!toolCallId || !toolName) {
            return messages;
        }

        const nextMessages = cloneMessages(messages);
        const assistantIndex = getLastAssistantIndex(nextMessages);

        if (assistantIndex < 0) {
            return messages;
        }

        const assistantMessage = nextMessages[assistantIndex];
        const traces = assistantMessage.toolTraces ?? [];
        const existingTrace = traces.find(
            (trace) => trace.callId === toolCallId,
        );

        const resultPayload = part.output ?? part.result ?? null;
        const isAskPending =
            toolName === "ask_tool" &&
            resultPayload &&
            typeof resultPayload === "object" &&
            Array.isArray((resultPayload as AskToolResult).questions) &&
            (resultPayload as AskToolResult).questions.some(
                (question) => !question.answer?.trim(),
            );

        const trace: ToolTrace = {
            callId: toolCallId,
            toolName,
            status: part.errorText
                ? "error"
                : isAskPending
                  ? "pending"
                  : "done",
            args: existingTrace?.args,
            result: resultPayload,
            error: part.errorText,
            createdAt: existingTrace?.createdAt ?? nowIso(),
            updatedAt: nowIso(),
        };

        nextMessages[assistantIndex] = {
            ...assistantMessage,
            toolTraces: upsertTrace(traces, trace),
            stages: ensureToolStage(assistantMessage, toolCallId, toolName),
        };

        return nextMessages;
    }

    setAskActiveQuestion(
        messages: DialogUiMessage[],
        messageId: string,
        toolCallId: string,
        activeQuestionIndex: number,
    ) {
        return messages.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            const traces = (message.toolTraces ?? []).map((trace) => {
                if (
                    trace.callId !== toolCallId ||
                    trace.toolName !== "ask_tool"
                ) {
                    return trace;
                }

                return {
                    ...trace,
                    result: updateAskResult(trace.result, (payload) => ({
                        ...payload,
                        activeQuestionIndex,
                    })),
                    updatedAt: nowIso(),
                };
            });

            return { ...message, toolTraces: traces };
        });
    }

    saveAskAnswer(
        messages: DialogUiMessage[],
        messageId: string,
        toolCallId: string,
        questionIndex: number,
        answer: string,
    ) {
        return messages.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            const traces = (message.toolTraces ?? []).map((trace) => {
                if (
                    trace.callId !== toolCallId ||
                    trace.toolName !== "ask_tool"
                ) {
                    return trace;
                }

                return {
                    ...trace,
                    result: updateAskResult(trace.result, (payload) => ({
                        ...payload,
                        questions: payload.questions.map((question, index) =>
                            index === questionIndex
                                ? { ...question, answer }
                                : question,
                        ),
                    })),
                    updatedAt: nowIso(),
                };
            });

            return { ...message, toolTraces: traces };
        });
    }

    markAskAnswered(
        messages: DialogUiMessage[],
        messageId: string,
        toolCallId: string,
    ) {
        return messages.map((message) => {
            if (message.id !== messageId) {
                return message;
            }

            const traces = (message.toolTraces ?? []).map((trace) => {
                if (
                    trace.callId !== toolCallId ||
                    trace.toolName !== "ask_tool"
                ) {
                    return trace;
                }

                return {
                    ...trace,
                    status: "done" as const,
                    result: updateAskResult(trace.result, (payload) => ({
                        ...payload,
                        answered: true,
                    })),
                    updatedAt: nowIso(),
                };
            });

            return { ...message, toolTraces: traces };
        });
    }

    getAskTrace(
        messages: DialogUiMessage[],
        messageId: string,
        toolCallId: string,
    ) {
        const message = messages.find((item) => item.id === messageId);

        if (!message) {
            return null;
        }

        return findAskTrace(message, toolCallId) ?? null;
    }

    buildAskAnswersPrompt(payload: AskToolResult) {
        const answersList = payload.questions
            .map((question, index) => {
                const answer = question.answer?.trim() || "(без ответа)";
                return `${index + 1}. ${question.question}\nОтвет: ${answer}`;
            })
            .join("\n\n");

        return `Ответы пользователя на уточняющие вопросы:\n\n${answersList}`;
    }
}

export const toolsStorage = new ToolsStorage();
