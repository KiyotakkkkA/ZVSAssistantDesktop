import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, InputBig } from "@kiyotakkkka/zvs-uikit-lib";
import type { ToolTrace } from "../../../../../../electron/models/tool";
import {
    normalizeQaToolState,
    qaToolHasCompleteAnswers,
    type QaToolState,
} from "../../../../../utils/tools/qaTool";

type QaToolBubbleCardProps = {
    toolTrace?: ToolTrace;
    answered?: boolean;
    onSelectQuestion: (questionIndex: number) => void;
    onSaveAnswer: (questionIndex: number, answer: string) => void;
    onSendAnswers: (qaState: QaToolState) => void;
};

export function QaToolBubbleCard({
    toolTrace,
    answered = false,
    onSelectQuestion,
    onSaveAnswer,
    onSendAnswers,
}: QaToolBubbleCardProps) {
    const qaState = useMemo(() => normalizeQaToolState(toolTrace), [toolTrace]);
    const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>(
        {},
    );

    useEffect(() => {
        setDraftAnswers((previous) => {
            const next = { ...previous };

            qaState.questions.forEach((question) => {
                if (!(question.id in next)) {
                    next[question.id] = question.answer || "";
                }
            });

            return next;
        });
    }, [qaState.questions]);

    const questions = qaState.questions;
    const activeQuestionIndex = qaState.activeQuestionIndex ?? 0;
    const currentQuestion = questions[activeQuestionIndex];
    const currentDraft = currentQuestion
        ? (draftAnswers[currentQuestion.id] ?? currentQuestion.answer ?? "")
        : "";
    const hasCurrentUnsavedChanges = Boolean(
        currentQuestion &&
        currentDraft.trim() !== (currentQuestion.answer || "").trim(),
    );
    const canSubmitAll =
        qaToolHasCompleteAnswers(qaState) && !hasCurrentUnsavedChanges;

    if (!currentQuestion) {
        return (
            <div className="w-full rounded-2xl border border-main-700/60 bg-main-900/60 px-4 py-3 text-sm text-main-100">
                Нужны дополнительные данные от пользователя.
            </div>
        );
    }

    const setDraft = (value: string) => {
        setDraftAnswers((previous) => ({
            ...previous,
            [currentQuestion.id]: value,
        }));
    };

    const saveCurrentAnswer = () => {
        const next = currentDraft.trim();

        if (!next) {
            return;
        }

        onSaveAnswer(activeQuestionIndex, next);
    };

    const selectQuickAnswer = (value: string) => {
        setDraftAnswers((previous) => ({
            ...previous,
            [currentQuestion.id]: value,
        }));
        onSaveAnswer(activeQuestionIndex, value);
    };

    return (
        <div className="w-full rounded-2xl border border-main-700/60 bg-main-900/60 px-4 py-3 text-sm text-main-100 space-y-3 animate-card-rise-in">
            <div className="flex items-center gap-2">
                <Icon
                    icon="mdi:chat-question-outline"
                    width={18}
                    height={18}
                    className="text-main-300"
                />
                <p className="text-sm font-semibold text-main-100">
                    Уточнение от ассистента
                </p>
                {answered && (
                    <span className="ml-auto text-xs text-main-400 flex items-center gap-1">
                        <Icon
                            icon="mdi:check"
                            width={14}
                            height={14}
                            className="text-green-400"
                        />
                        Отвечено
                    </span>
                )}
            </div>

            {questions.length > 1 ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-main-300">
                            Вопросы: {activeQuestionIndex + 1}/
                            {questions.length}
                        </p>
                        <p className="text-xs text-main-400">
                            Ответьте на все вопросы, чтобы ассистент продолжил.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {questions.map((question, index) => {
                            const hasAnswer = Boolean(question.answer?.trim());

                            return (
                                <Button
                                    key={question.id}
                                    variant={
                                        index === activeQuestionIndex
                                            ? "primary"
                                            : "secondary"
                                    }
                                    shape="rounded-lg"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => onSelectQuestion(index)}
                                >
                                    {hasAnswer ? "✓ " : ""}Вопрос {index + 1}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            <div className="rounded-xl border border-main-700/70 bg-main-900/45 p-3 space-y-2">
                <p className="text-sm text-main-100">
                    {currentQuestion.question}
                </p>

                {currentQuestion.reason ? (
                    <p className="text-xs text-main-400">
                        Причина: {currentQuestion.reason}
                    </p>
                ) : null}
            </div>

            {questions.some((question) => question.answer?.trim()) ? (
                <div className="space-y-2 rounded-xl border border-main-700/70 bg-main-900/35 p-3">
                    <p className="text-xs font-semibold text-main-300">
                        Сохраненные ответы
                    </p>
                    <div className="space-y-2 text-xs text-main-300">
                        {questions.map((question, index) => (
                            <div
                                key={question.id}
                                className="rounded-lg bg-main-950/30 px-3 py-2"
                            >
                                <p className="text-main-200">
                                    {index + 1}. {question.question}
                                </p>
                                <p className="mt-1 text-main-400">
                                    {question.answer?.trim() ||
                                        "Ответ еще не сохранен"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {!answered ? (
                <>
                    {currentQuestion.selectAnswers &&
                    currentQuestion.selectAnswers.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs text-main-300">
                                Быстрый выбор
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {currentQuestion.selectAnswers.map((option) => (
                                    <Button
                                        key={option}
                                        variant="secondary"
                                        shape="rounded-lg"
                                        className="h-8 px-3 text-xs"
                                        onClick={() =>
                                            selectQuickAnswer(option)
                                        }
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <p className="text-xs text-main-300">
                            Развернутый ответ
                        </p>
                        <InputBig
                            value={currentDraft}
                            onChange={(value) => setDraft(value.target.value)}
                            className="h-24 rounded-xl border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100"
                            placeholder={
                                currentQuestion.userAnswerHint ||
                                "Введите ваш ответ"
                            }
                        />
                        {hasCurrentUnsavedChanges ? (
                            <p className="text-xs text-amber-300">
                                Есть несохраненные изменения для текущего
                                вопроса.
                            </p>
                        ) : null}
                        <div className="flex justify-between gap-2">
                            <Button
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-8 px-3 text-xs"
                                onClick={saveCurrentAnswer}
                                disabled={!currentDraft.trim()}
                            >
                                Сохранить ответ
                            </Button>
                            {activeQuestionIndex === questions.length - 1 ? (
                                <Button
                                    variant="primary"
                                    shape="rounded-lg"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => {
                                        const mergedQuestions = questions.map(
                                            (question) => ({
                                                ...question,
                                                answer:
                                                    draftAnswers[question.id] ??
                                                    question.answer,
                                            }),
                                        );

                                        onSendAnswers({
                                            ...qaState,
                                            questions: mergedQuestions,
                                            answered: true,
                                        });
                                    }}
                                    disabled={!canSubmitAll}
                                >
                                    Ответить и продолжить
                                </Button>
                            ) : null}
                        </div>
                        {activeQuestionIndex === questions.length - 1 &&
                        !canSubmitAll ? (
                            <p className="text-xs text-main-400">
                                Перед отправкой сохраните текущий ответ и
                                заполните все вопросы.
                            </p>
                        ) : null}
                    </div>
                </>
            ) : null}
        </div>
    );
}
