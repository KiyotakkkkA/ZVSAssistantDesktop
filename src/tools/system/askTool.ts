import { z } from "zod";
import type { AskToolResult } from "../../../electron/models/tool";
import type { ToolDefinition } from "../runtime/contracts";

const askQuestionSchema = z.union([
    z.string().min(1),
    z.object({
        id: z.string().min(1).optional(),
        question: z.string().min(1),
        reason: z.string().min(1).optional(),
        selectAnswers: z.array(z.string().min(1)).optional(),
        userAnswerHint: z.string().min(1).optional(),
    }),
]);

const askToolInputSchema = z.object({
    questions: z.array(askQuestionSchema).min(1),
    activeQuestionIndex: z.number().int().nonnegative().optional(),
});

type AskToolInput = z.infer<typeof askToolInputSchema>;

const toNormalizedQuestions = (questions: AskToolInput["questions"]) => {
    return questions.map((question, index) => {
        if (typeof question === "string") {
            return {
                id: `q-${index + 1}`,
                question,
            };
        }

        return {
            id: question.id ?? `q-${index + 1}`,
            question: question.question,
            reason: question.reason,
            selectAnswers: question.selectAnswers,
            userAnswerHint: question.userAnswerHint,
        };
    });
};

export const askTool: ToolDefinition = {
    name: "ask_tool",
    description:
        "Запрашивает у пользователя недостающие данные через список уточняющих вопросов.",
    inputSchema: askToolInputSchema,
    execute: (args) => {
        const input = askToolInputSchema.parse(args);
        const questions = toNormalizedQuestions(input.questions);
        const activeQuestionIndex = Math.max(
            0,
            Math.min(
                input.activeQuestionIndex ?? 0,
                Math.max(questions.length - 1, 0),
            ),
        );

        return {
            questions,
            activeQuestionIndex,
            answered: false,
        } satisfies AskToolResult;
    },
};
