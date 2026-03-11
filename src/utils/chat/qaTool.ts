import type {
    QaToolQuestionState,
    QaToolState,
    ToolTrace,
} from "../../types/Chat";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const pickString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const pickStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
};

const normalizeQuestion = (
    value: unknown,
    index: number,
): QaToolQuestionState | null => {
    if (typeof value === "string") {
        const question = value.trim();

        if (!question) {
            return null;
        }

        return {
            id: `qa_${index + 1}`,
            question,
        };
    }

    if (!isRecord(value)) {
        return null;
    }

    const question = pickString(value.question);

    if (!question) {
        return null;
    }

    return {
        id: pickString(value.id) || `qa_${index + 1}`,
        question,
        reason: pickString(value.reason),
        selectAnswers: pickStringArray(value.selectAnswers),
        userAnswerHint: pickString(value.userAnswerHint || value.userAnswer),
        answer: pickString(value.answer),
    };
};

const extractRawQuestions = (toolTrace?: ToolTrace): QaToolQuestionState[] => {
    const args = isRecord(toolTrace?.args) ? toolTrace.args : {};
    const result = isRecord(toolTrace?.result) ? toolTrace.result : {};
    const candidateLists = [result.questions, args.questions];

    for (const candidate of candidateLists) {
        if (!Array.isArray(candidate)) {
            continue;
        }

        const normalized = candidate
            .map((item, index) => normalizeQuestion(item, index))
            .filter((item): item is QaToolQuestionState => Boolean(item));

        if (normalized.length > 0) {
            return normalized;
        }
    }

    const fallbackQuestion =
        pickString(result.question) || pickString(args.question);

    if (!fallbackQuestion) {
        return [];
    }

    return [
        {
            id: "qa_1",
            question: fallbackQuestion,
            reason: pickString(result.reason) || pickString(args.reason),
            selectAnswers: [
                ...new Set([
                    ...pickStringArray(result.selectAnswers),
                    ...pickStringArray(args.selectAnswers),
                ]),
            ],
            userAnswerHint:
                pickString(result.userAnswerHint || result.userAnswer) ||
                pickString(args.userAnswerHint || args.userAnswer),
        },
    ];
};

export const normalizeQaToolState = (toolTrace?: ToolTrace): QaToolState => {
    const baseQuestions = extractRawQuestions(toolTrace);
    const persistedState = toolTrace?.qaState;

    const questions = baseQuestions.map((question, index) => {
        const persistedQuestion = persistedState?.questions[index];

        return {
            ...question,
            answer: pickString(persistedQuestion?.answer) || question.answer,
        };
    });

    const maxIndex = Math.max(questions.length - 1, 0);
    const rawActiveIndex = persistedState?.activeQuestionIndex ?? 0;
    const activeQuestionIndex = Math.min(Math.max(rawActiveIndex, 0), maxIndex);

    return {
        activeQuestionIndex,
        questions,
    };
};

export const qaToolHasSavedAnswers = (qaState: QaToolState): boolean =>
    qaState.questions.some((question) => Boolean(pickString(question.answer)));

export const qaToolHasCompleteAnswers = (qaState: QaToolState): boolean =>
    qaState.questions.length > 0 &&
    qaState.questions.every((question) => Boolean(pickString(question.answer)));

export const buildQaToolSubmission = (qaState: QaToolState): string => {
    const lines = ["Ответы на уточняющие вопросы:", ""];

    qaState.questions.forEach((question, index) => {
        lines.push(`${index + 1}. Вопрос: ${question.question}`);
        lines.push(`Ответ: ${pickString(question.answer) || "Не указан"}`);

        if (question.reason) {
            lines.push(`Контекст: ${question.reason}`);
        }

        lines.push("");
    });

    return lines.join("\n").trim();
};
