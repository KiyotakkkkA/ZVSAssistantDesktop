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
        "Manages a execution plan: createSteps creates steps, markStep marks a step as completed, getNextStep retrieves the next pending step." +
        "planning_tool arguments contract: use a single field type with one of createSteps | markStep | getNextStep." +
        "Use planning_tool(type=createSteps) at the beginning of a complex task with title and ordered steps array of 3-12 short actionable items." +
        "Use planning_tool(type=markStep) immediately after finishing a concrete step and pass stepId as integer from the current plan." +
        "Use planning_tool(type=getNextStep) when you need to continue execution and must retrieve the next pending step." +
        "Do not call markStep before createSteps. Do not invent stepId values that are absent in the current plan." +
        "Valid examples: {type:'createSteps',title:'Trip Plan',steps:['Collect constraints','Build route','Estimate budget']}, {type:'markStep',stepId:2}, {type:'getNextStep'}.",
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
