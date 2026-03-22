import type { AskToolResult, ToolTrace } from "../../../electron/models/tool";

export type QaToolState = {
    questions: AskToolResult["questions"];
    activeQuestionIndex: number;
    answered: boolean;
};

const isAskToolResult = (value: unknown): value is AskToolResult => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const payload = value as AskToolResult;

    return Array.isArray(payload.questions);
};

export const normalizeQaToolState = (toolTrace?: ToolTrace): QaToolState => {
    if (!toolTrace || toolTrace.toolName !== "ask_tool") {
        return {
            questions: [],
            activeQuestionIndex: 0,
            answered: false,
        };
    }

    if (!isAskToolResult(toolTrace.result)) {
        return {
            questions: [],
            activeQuestionIndex: 0,
            answered: false,
        };
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
    if (qaState.questions.length === 0) {
        return false;
    }

    return qaState.questions.every((question) =>
        Boolean(question.answer?.trim()),
    );
};
