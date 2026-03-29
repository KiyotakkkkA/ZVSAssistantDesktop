import type { AskToolResult, ToolTrace } from "../../../electron/models/tool";
import type { DialogUiMessage } from "../../../electron/models/dialog";

export type QaToolState = {
    questions: AskToolResult["questions"];
    activeQuestionIndex: number;
    answered: boolean;
};

const EMPTY_QA_STATE: QaToolState = {
    questions: [],
    activeQuestionIndex: 0,
    answered: false,
};

export const isAskToolResult = (value: unknown): value is AskToolResult => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const payload = value as AskToolResult;

    return Array.isArray(payload.questions);
};

export const hasPendingAskAnswers = (resultPayload: unknown) => {
    if (!isAskToolResult(resultPayload)) {
        return false;
    }

    return resultPayload.questions.some((question) => !question.answer?.trim());
};

export const updateAskResult = (
    result: unknown,
    updater: (payload: AskToolResult) => AskToolResult,
) => {
    if (!isAskToolResult(result)) {
        return result;
    }

    return updater(result);
};

export const updateAskTraceInMessage = (
    message: DialogUiMessage,
    toolCallId: string,
    updater: (trace: ToolTrace) => ToolTrace,
): DialogUiMessage => {
    const traces = message.toolTraces ?? [];
    let wasUpdated = false;

    const nextTraces = traces.map((trace) => {
        if (trace.callId !== toolCallId || trace.toolName !== "ask_tool") {
            return trace;
        }

        wasUpdated = true;
        return updater(trace);
    });

    if (!wasUpdated) {
        return message;
    }

    return { ...message, toolTraces: nextTraces };
};

export const findAskTrace = (message: DialogUiMessage, callId: string) => {
    const traces = message.toolTraces ?? [];

    return traces.find(
        (trace) => trace.callId === callId && trace.toolName === "ask_tool",
    );
};

export const buildAskAnswersPrompt = (payload: AskToolResult) => {
    const answersList = payload.questions
        .map((question, index) => {
            const answer = question.answer?.trim() || "(без ответа)";
            return `${index + 1}. ${question.question}\nОтвет: ${answer}`;
        })
        .join("\n\n");

    return `Ответы пользователя на уточняющие вопросы:\n\n${answersList}`;
};

export const normalizeQaToolState = (toolTrace?: ToolTrace): QaToolState => {
    if (!toolTrace || toolTrace.toolName !== "ask_tool") {
        return EMPTY_QA_STATE;
    }

    if (!isAskToolResult(toolTrace.result)) {
        return EMPTY_QA_STATE;
    }

    const activeQuestionIndex = Math.max(
        0,
        Math.min(
            toolTrace.result.activeQuestionIndex ?? 0,
            Math.max(toolTrace.result.questions.length - 1, 0),
        ),
    );

    const answeredByQuestions = toolTrace.result.questions.every((question) =>
        Boolean(question.answer?.trim()),
    );

    return {
        questions: toolTrace.result.questions,
        activeQuestionIndex,
        answered: Boolean(toolTrace.result.answered || answeredByQuestions),
    };
};

export const qaToolHasCompleteAnswers = (qaState: QaToolState) => {
    return (
        qaState.questions.length > 0 &&
        qaState.questions.every((question) => Boolean(question.answer?.trim()))
    );
};
