import type { DialogUiMessage } from "../../../electron/models/dialog";
import type { ToolTrace } from "../../../electron/models/tool";

type ToolStage = NonNullable<DialogUiMessage["stages"]>[number];

export const hasPlanningToolStage = (
    stages: ToolStage[],
    traces: ToolTrace[],
) => {
    const planningCallIds = new Set(
        traces
            .filter((trace) => trace.toolName === "planning_tool")
            .map((trace) => trace.callId),
    );

    return stages.some(
        (stage) =>
            stage.type === "tool" && planningCallIds.has(stage.toolCallId),
    );
};
