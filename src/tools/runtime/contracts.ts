import { tool, type ToolSet } from "ai";
import type { ZodTypeAny } from "zod";
import type { PlanningStateStorage } from "./planningStateStorage";

export type ToolExecutionContext = {
    dialogId: string;
    planningStateStorage: PlanningStateStorage;
    ollamaApiKey?: string;
};

export type ToolDefinition = {
    name: string;
    description: string;
    inputSchema: ZodTypeAny;
    execute: (
        args: unknown,
        context: ToolExecutionContext,
    ) => Promise<unknown> | unknown;
};

export type ToolPack = {
    id: string;
    title: string;
    description: string;
    tools: ToolDefinition[];
};

export const createToolPack = (toolPack: ToolPack) => toolPack;

export const buildToolSetFromPacks = (
    packs: ToolPack[],
    context: ToolExecutionContext,
): ToolSet => {
    const toolSet: ToolSet = {};

    for (const pack of packs) {
        for (const definition of pack.tools) {
            toolSet[definition.name] = tool({
                description: definition.description,
                inputSchema: definition.inputSchema,
                execute: (args) => definition.execute(args, context),
            });
        }
    }

    return toolSet;
};
