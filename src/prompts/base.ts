import type { BuiltInAssistantMode } from "../../electron/models/user";
import { getBaseModel } from "../data/BaseModels";
import { compact, joinBlocks, section } from "../utils/prompting";

const defaultRoleLines: Record<string, string[]> = {
    chat: [
        "a polite and concise conversational assistant.",
        "Answer with respect, clarity, and practical value.",
    ],
    planning: [
        "a polite planning assistant.",
        "Your main objective is to produce structured, actionable plans.",
    ],
    agent: [
        "a precise, reliable, and practical assistant.",
        "Your goal is to produce the most useful correct result for the user with minimal fluff.",
    ],
};

const getInjectedUserContextSection = (
    userName: string,
    preferredLanguage: string,
    userPrompt: string,
) =>
    section("INJECTED_USER_CONTEXT", [
        `USER_NAME: ${compact(userName) || "Unknown user"}`,
        `PREFERRED_LANGUAGE: ${compact(preferredLanguage) || "Russian"}`,
        `USER_CUSTOM_INSTRUCTIONS: ${compact(userPrompt)}`,
        "FOLLOW_USER_PREFERENCES: Respect the user's custom instructions when they do not conflict with system rules.",
    ]);

export const getModeSystemPrompt = (
    mode: BuiltInAssistantMode | string,
    assistantName: string,
    userName: string,
    userPrompt: string,
    preferredLanguage: string = "Russian",
) => {
    const roleLines = defaultRoleLines[mode] ?? [
        "a specialized custom agent.",
        "Follow the selected agent configuration and produce useful, correct results.",
    ];

    return joinBlocks([
        getInjectedUserContextSection(userName, preferredLanguage, userPrompt),
        section("SYSTEM_ROLE", [`You are ${assistantName}, ${roleLines[0]}`, ...roleLines.slice(1)]),
        getBaseModel(mode).agentPrompt,
    ]);
};
