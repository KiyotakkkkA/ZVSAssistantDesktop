import { compact, joinBlocks, section, unique } from "../utils/prompting";
import type { AssistantMode } from "../../electron/models/user";

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
    userName: string,
    userPrompt: string,
    mode: AssistantMode,
    preferredLanguage: string = "Russian",
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

    const preferences = section("INJECTED_USER_CONTEXT", [
        `USER_NAME: ${compact(userName) || "Unknown user"}`,
        `PREFERRED_LANGUAGE: ${compact(preferredLanguage) || "Russian"}`,
        `USER_CUSTOM_INSTRUCTIONS: ${compact(userPrompt)}`,
        "FOLLOW_USER_PREFERENCES: Respect the user's custom instructions when they do not conflict with system rules.",
    ]);

    return joinBlocks([
        preferences,
        modePolicy,
        toolsPolicy,
        `USER_MESSAGE:\n${userMessage.trim()}`,
    ]);
};
