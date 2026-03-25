import { makeAutoObservable } from "mobx";
import type { AskToolResult, ToolTrace } from "../../electron/models/tool";
import type { DialogUiMessage } from "../../electron/models/dialog";
import {
    cloneMessages,
    ensureToolStage,
    getLastAssistantIndex,
    nowIso,
    type ToolCallPart,
    type ToolResultPart,
    upsertTrace,
} from "../utils/tools/toolStorage";
import {
    buildAskAnswersPrompt,
    findAskTrace,
    hasPendingAskAnswers,
    updateAskResult,
    updateAskTraceInMessage,
} from "../utils/tools/qaTool";

class ToolsStorage {
    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    applyToolCall(messages: DialogUiMessage[], part: ToolCallPart) {
        const toolCallId = part.toolCallId ?? null;
        const toolName = part.toolName ?? null;

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
        const toolCallId = part.toolCallId ?? null;
        const toolName = part.toolName ?? null;

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
            toolName === "ask_tool" && hasPendingAskAnswers(resultPayload);

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

            return updateAskTraceInMessage(message, toolCallId, (trace) => ({
                ...trace,
                result: updateAskResult(trace.result, (payload) => ({
                    ...payload,
                    activeQuestionIndex,
                })),
                updatedAt: nowIso(),
            }));
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

            return updateAskTraceInMessage(message, toolCallId, (trace) => ({
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
            }));
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

            return updateAskTraceInMessage(message, toolCallId, (trace) => ({
                ...trace,
                status: "done" as const,
                result: updateAskResult(trace.result, (payload) => ({
                    ...payload,
                    answered: true,
                })),
                updatedAt: nowIso(),
            }));
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
        return buildAskAnswersPrompt(payload);
    }
}

export const toolsStorage = new ToolsStorage();
