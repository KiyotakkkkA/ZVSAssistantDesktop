import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, InputBig } from "../../../atoms";
import type { ToolTrace } from "../../../../../types/Chat";

type QaToolBubbleCardProps = {
    toolTrace?: ToolTrace;
    answered?: boolean;
    onSendAnswer: (answer: string) => void;
};

const pickString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const pickStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
};

export function QaToolBubbleCard({
    toolTrace,
    answered = false,
    onSendAnswer,
}: QaToolBubbleCardProps) {
    const [answer, setAnswer] = useState("");

    const payload = useMemo(() => {
        const args = (toolTrace?.args || {}) as Record<string, unknown>;
        const result = (toolTrace?.result || {}) as Record<string, unknown>;

        const question =
            pickString(result.question) || pickString(args.question);
        const reason = pickString(result.reason) || pickString(args.reason);
        const selectAnswers = [
            ...new Set([
                ...pickStringArray(result.selectAnswers),
                ...pickStringArray(args.selectAnswers),
            ]),
        ];
        const userAnswerHint =
            pickString(result.userAnswer) || pickString(args.userAnswer);

        return {
            question,
            reason,
            selectAnswers,
            userAnswerHint,
        };
    }, [toolTrace?.args, toolTrace?.result]);

    const submitAnswer = () => {
        const next = answer.trim();

        if (!next) {
            return;
        }

        onSendAnswer(next);
        setAnswer("");
    };

    return (
        <div className="w-full rounded-2xl border border-main-700/60 bg-main-900/60 px-4 py-3 text-sm text-main-100 space-y-3">
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

            <div className="rounded-xl border border-main-700/70 bg-main-900/45 p-3 space-y-2">
                <p className="text-sm text-main-100">
                    {payload.question ||
                        "Нужны дополнительные данные от пользователя."}
                </p>

                {payload.reason ? (
                    <p className="text-xs text-main-400">
                        Причина: {payload.reason}
                    </p>
                ) : null}
            </div>

            {!answered && (
                <>
                    {payload.selectAnswers.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs text-main-300">
                                Быстрый выбор
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {payload.selectAnswers.map((option) => (
                                    <Button
                                        key={option}
                                        variant="secondary"
                                        shape="rounded-lg"
                                        className="h-8 px-3 text-xs"
                                        onClick={() => onSendAnswer(option)}
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <p className="text-xs text-main-300">
                            Развёрнутый ответ
                        </p>
                        <InputBig
                            value={answer}
                            onChange={(value) => setAnswer(value.target.value)}
                            className="h-24 rounded-xl border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100"
                            placeholder={"Введите ваш ответ"}
                        />
                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                shape="rounded-lg"
                                className="h-8 px-3 text-xs"
                                onClick={submitAnswer}
                                disabled={!answer.trim()}
                            >
                                Отправить ответ
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
