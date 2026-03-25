import type { DialogUiMessage } from "../../../electron/models/dialog";

type ToolStage = NonNullable<DialogUiMessage["stages"]>[number];

export const hasPlanningToolStage = (
    message: DialogUiMessage,
    stages: ToolStage[],
) => {
    return stages.some(
        (stage) =>
            stage.type === "tool" &&
            (message.toolTraces ?? []).some(
                (trace) =>
                    trace.callId === stage.toolCallId &&
                    trace.toolName === "planning_tool",
            ),
    );
};
