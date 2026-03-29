import { z } from "zod";
import type { ToolDefinition } from "../runtime/contracts";

const planningCreateSchema = z.object({
    type: z.literal("createSteps"),
    title: z.string().min(1).optional(),
    steps: z.array(z.string().min(1)).min(1),
});

const planningMarkSchema = z.object({
    type: z.literal("markStep"),
    stepId: z.number().int().positive(),
});

const planningNextSchema = z.object({
    type: z.literal("getNextStep"),
});

const planningToolInputSchema = z.discriminatedUnion("type", [
    planningCreateSchema,
    planningMarkSchema,
    planningNextSchema,
]);

const PLAN_NOT_FOUND_ERROR = {
    error: "План не найден. Сначала вызовите planning_tool с type=createSteps.",
};

export const planningTool: ToolDefinition = {
    name: "planning_tool",
    description:
        "Управляет планом выполнения: createSteps создает шаги, markStep отмечает шаг завершенным, getNextStep возвращает следующий шаг.",
    inputSchema: planningToolInputSchema,
    execute: (args, context) => {
        const input = planningToolInputSchema.parse(args);
        const { planningStateStorage } = context;

        if (input.type === "createSteps") {
            return planningStateStorage.createSteps(
                context.dialogId,
                input.title ?? "План выполнения",
                input.steps,
            );
        }

        if (input.type === "markStep") {
            const updatedPlan = planningStateStorage.markStep(
                context.dialogId,
                input.stepId,
            );

            return updatedPlan ?? PLAN_NOT_FOUND_ERROR;
        }

        return (
            planningStateStorage.getNextStep(context.dialogId) ??
            PLAN_NOT_FOUND_ERROR
        );
    },
};
