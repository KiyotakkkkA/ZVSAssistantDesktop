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

const normalizeQuestion = (
    question: AskToolInput["questions"][number],
    index: number,
) => {
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
};

export const askTool: ToolDefinition = {
    name: "ask_tool",
    description:
        "Запрашивает у пользователя недостающие данные через список уточняющих вопросов.",
    inputSchema: askToolInputSchema,
    execute: (args) => {
        const input = askToolInputSchema.parse(args);

        const result: AskToolResult = {
            questions: input.questions.map(normalizeQuestion),
            activeQuestionIndex: input.activeQuestionIndex ?? 0,
            answered: false,
        };

        return result;
    },
};
