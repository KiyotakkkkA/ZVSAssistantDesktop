import { createToolPack } from "./runtime/contracts";
import { askTool, planningTool, webFetchTool, webSearchTool } from "./system";

const systemToolsPack = createToolPack({
    id: "systemTools",
    title: "System Tools",
    description: "Базовый набор системных инструментов ассистента.",
    tools: [askTool, planningTool, webSearchTool, webFetchTool],
});

export const builtInToolPacks = [systemToolsPack];
