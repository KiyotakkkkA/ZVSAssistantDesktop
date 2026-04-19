import { joinBlocks, section, unique } from "../utils/prompting";
import type { AssistantMode } from "../../electron/models/user";
import type { VecstoreSearchResult } from "../../electron/models/chat";

export const getMustToolsUsagePolicy = (
    enabledTools: string[] = [],
    requiredTools: string[] = [],
) => {
    const enabled = unique(enabledTools);

    if (enabled.length === 0) {
        return "";
    }

    const required = unique(requiredTools).filter((toolName) =>
        enabled.includes(toolName),
    );

    return section("MUST_TOOLS_USAGE_POLICY", [
        `Enabled tools: ${enabled.join(", ")}.`,
        required.length > 0
            ? `Mandatory tools: ${required.join(", ")}.`
            : "Mandatory tools: none.",
        required.length > 0
            ? "When relevant and available, use each mandatory tool at least once before finalizing the answer."
            : "If any enabled tool materially improves quality, use it proactively.",
        "If a mandatory tool is unavailable or not applicable, briefly explain why and continue with the best alternative.",
    ]);
};

export const getUserPrompt = (
    userMessage: string,
    mode: AssistantMode,
    enabledPromptTools: string[] = [],
    requiredPromptTools: string[] = [],
) => {
    const toolsPolicy =
        mode === "agent"
            ? getMustToolsUsagePolicy(enabledPromptTools, requiredPromptTools)
            : "";

    const modePolicy =
        mode === "chat"
            ? section("MODE_POLICY", [
                  "Current mode: chat.",
                  "Tools are disabled. If user asks for tool execution, reply politely that tools are unavailable in chat mode.",
              ])
            : mode === "planning"
              ? section("MODE_POLICY", [
                    "Current mode: planning.",
                    "Tools are disabled. If user asks for tool execution, reply politely that tools are unavailable in planning mode.",
                ])
              : section("MODE_POLICY", [
                    "Current mode: agent.",
                    "Tools may be used according to enabled and mandatory policy.",
                ]);

    const envData = section("ENVIRONMENT_DATA", [
        "CURRENT_DATETIME: " + new Date().toLocaleString(),
    ]);

    return joinBlocks([
        envData,
        modePolicy,
        toolsPolicy,
        `USER_MESSAGE:\n${userMessage.trim()}`,
    ]);
};

export const getVecstoreSourcesInjectablePrompt = (
    activeDialogTitle: string | null,
    sources: VecstoreSearchResult[],
) => {
    console.log(sources);
    const hasSources = sources.length > 0;
    const sourceLines = hasSources
        ? sources
              .map((source, index) => {
                  return [
                      `${index + 1}. [${source.vecstoreName}] ${source.filePath}#${source.chunkIndex}`,
                      `Confidence: ${source.confidencePercentage}%`,
                      `Content: ${source.content}`,
                  ].join("\n");
              })
              .join("\n\n")
        : "Sources not found or no vector store selected.";

    return joinBlocks([
        "INJECTED_VECSTORE_CONTEXT:",
        `ACTIVE_STORAGE: ${activeDialogTitle}`,
        "SOURCE_USAGE_POLICY:\n- Use the retrieved sources to enhance the answer when they are relevant to the user's question.\n- If sources are not relevant, do not use them and do not mention them in the answer.\n- Do not fabricate or alter source information. Use the sources as they are provided.",
        `RETRIEVED_SOURCES:\n${sourceLines}`,
    ]);
};
