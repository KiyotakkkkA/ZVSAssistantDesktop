import { createToolPack } from "./runtime/contracts";
import { askTool, planningTool } from "./system";

const systemToolsPack = createToolPack({
    id: "systemTools",
    title: "System Tools",
    description: "Базовый набор системных инструментов ассистента.",
    tools: [askTool, planningTool],
});

export const builtInToolPacks = [systemToolsPack];
