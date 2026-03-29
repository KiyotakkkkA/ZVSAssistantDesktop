import type { ToolTrace } from "../../../electron/models/tool";
import type { DialogUiMessage } from "../../../electron/models/dialog";
import { hasPlanningToolStage } from "./planningTool";

export type ToolCallPart = {
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
    args?: unknown;
};

export type ToolResultPart = {
    toolCallId?: string;
    toolName?: string;
    output?: unknown;
    result?: unknown;
    errorText?: string;
};

export const nowIso = () => new Date().toISOString();

export const createStageId = (): `stg-${string}` =>
    `stg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const cloneMessages = (messages: DialogUiMessage[]) => [...messages];

export const getLastAssistantIndex = (messages: DialogUiMessage[]) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === "assistant") {
            return index;
        }
    }

    return -1;
};

export const ensureToolStage = (
    message: DialogUiMessage,
    toolCallId: string,
    toolName: string,
) => {
    const stages = message.stages ?? [];
    const traces = message.toolTraces ?? [];

    if (toolName === "planning_tool" && hasPlanningToolStage(stages, traces)) {
        return stages;
    }

    const alreadyExists = stages.some(
        (stage) => stage.type === "tool" && stage.toolCallId === toolCallId,
    );

    if (alreadyExists) {
        return stages;
    }

    return [
        ...stages,
        {
            id: createStageId(),
            type: "tool" as const,
            toolCallId,
        },
    ];
};

export const upsertTrace = (
    traces: ToolTrace[],
    nextTrace: ToolTrace,
): ToolTrace[] => {
    const existingIndex = traces.findIndex(
        (trace) => trace.callId === nextTrace.callId,
    );

    if (existingIndex < 0) {
        return [...traces, nextTrace];
    }

    const next = [...traces];
    next[existingIndex] = {
        ...next[existingIndex],
        ...nextTrace,
        createdAt: next[existingIndex].createdAt,
        updatedAt: nowIso(),
    };

    return next;
};
