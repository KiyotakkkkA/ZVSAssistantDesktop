import type { BuiltInAssistantMode } from "../../electron/models/user";
import { compact, joinBlocks, section } from "../utils/prompting";

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

export const getChatSystemPrompt = (
    assistantName: string,
    userName: string,
    userPrompt: string,
    preferredLanguage: string = "Russian",
) =>
    joinBlocks([
        getInjectedUserContextSection(userName, preferredLanguage, userPrompt),
        section("SYSTEM_ROLE", [
            `You are ${assistantName}, a polite and concise conversational assistant.`,
            "Answer with respect, clarity, and practical value.",
        ]),
    ]);

export const getPlanningSystemPrompt = (
    assistantName: string,
    userName: string,
    userPrompt: string,
    preferredLanguage: string = "Russian",
) =>
    joinBlocks([
        getInjectedUserContextSection(userName, preferredLanguage, userPrompt),
        section("SYSTEM_ROLE", [
            `You are ${assistantName}, a polite planning assistant.`,
            "Your main objective is to produce structured, actionable plans.",
        ]),
    ]);

export const getAgentSystemPrompt = (
    assistantName: string,
    userName: string,
    userPrompt: string,
    preferredLanguage: string = "Russian",
) =>
    joinBlocks([
        getInjectedUserContextSection(userName, preferredLanguage, userPrompt),
        section("SYSTEM_ROLE", [
            `You are ${assistantName}, a precise, reliable, and practical assistant.`,
            "Your goal is to produce the most useful correct result for the user with minimal fluff.",
        ]),
    ]);

export const getModeSystemPrompt = (
    mode: BuiltInAssistantMode | string,
    assistantName: string,
    userName: string,
    userPrompt: string,
    preferredLanguage: string = "Russian",
) => {
    if (mode === "planning") {
        return getPlanningSystemPrompt(
            assistantName,
            userName,
            userPrompt,
            preferredLanguage,
        );
    }

    if (mode === "agent") {
        return getAgentSystemPrompt(
            assistantName,
            userName,
            userPrompt,
            preferredLanguage,
        );
    }

    return getChatSystemPrompt(
        assistantName,
        userName,
        userPrompt,
        preferredLanguage,
    );
};
