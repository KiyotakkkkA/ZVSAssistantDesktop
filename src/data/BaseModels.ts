import { Agent } from "../../electron/models/agent";
import type { BuiltInAssistantMode } from "../../electron/models/user";
import { joinBlocks, section } from "../utils/prompting";

export type AssistantModeConfig = Record<BuiltInAssistantMode | string, Agent>;

export const builtInAgents: AssistantModeConfig = {
    chat: {
        id: "builtin-chat",
        agentName: "", // Заполняется во время использования из поля profileStore.generalData.assistantName
        agentPrompt: (() => {
            return joinBlocks([
                section("CHAT_MODE_POLICY", [
                    "This is chat mode. Do not use tools and do not claim tool execution.",
                    "If the user asks for tool-based actions, politely explain that tools are unavailable in chat mode.",
                ]),
                section("STYLE", [
                    "Be friendly and professional.",
                    "Keep responses focused and easy to read.",
                ]),
            ]);
        })(),
        agentToolsSet: [],
        chatLabel: "Чат",
        chatIcon: "mdi:message-text-outline",
        chatPlaceholder: "Задайте вопрос...",
        isEditable: false,
        modelProvider: "", // Заполняется во время использования из поля profileStore.generalData.chatGenProvider
        modelBaseUrl: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].baseUrl
        modelName: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].modelName
        modelApiKey: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].apiKey
    },
    planning: {
        id: "builtin-planning",
        agentName: "", // Заполняется во время использования из поля profileStore.generalData.assistantName
        agentPrompt: (() => {
            return joinBlocks([
                section("PLANNING_MODE_POLICY", [
                    "This is planning mode. Do not use tools and do not claim tool execution.",
                    "If the user requests external actions or checks, politely explain that tools are unavailable in planning mode.",
                    "Clarify target outcome, constraints, and success criteria when missing.",
                    "Build plans as ordered steps from preparation to completion.",
                    "Each step should be short, concrete, and verifiable.",
                    "Include risks, dependencies, and fallback actions when relevant.",
                ]),
                section("STYLE", [
                    "Be concise, calm, and professional.",
                    "Do not be overly verbose, repetitive, apologetic, or theatrical.",
                    "Prefer strong content over filler transitions.",
                ]),
            ]);
        })(),
        agentToolsSet: [],
        chatLabel: "Планирование",
        chatIcon: "mdi:format-list-checks",
        chatPlaceholder: "Постройте план действий...",
        isEditable: false,
        modelProvider: "", // Заполняется во время использования из поля profileStore.generalData.chatGenProvider
        modelBaseUrl: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].baseUrl
        modelName: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].modelName
        modelApiKey: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].apiKey
    },
    agent: {
        id: "builtin-agent",
        agentName: "", // Заполняется во время использования из поля profileStore.generalData.assistantName
        agentPrompt: (() => {
            return joinBlocks([
                section("STYLE", [
                    "Be concise, calm, and professional.",
                    "Do not be overly verbose, repetitive, apologetic, or theatrical.",
                    "Prefer strong content over filler transitions.",
                ]),
                section("AGENT_MODE_POLICY", [
                    "This is agent mode. You have access to tools and can claim tool execution.",
                    "Use tools to answer user requests that require external information or actions.",
                    "When a user request can be answered with high confidence without tools, you may answer directly.",
                ]),
                section("STYLE", [
                    "Be concise, calm, and professional.",
                    "Do not be overly verbose, repetitive, apologetic, or theatrical.",
                    "Prefer strong content over filler transitions.",
                ]),
                section("CORE_RULES", [
                    "Be truthful. Do not invent facts, results, files, tool outputs, or capabilities.",
                    "If important information is missing, ask for it clearly instead of guessing.",
                    "Prefer direct, concrete, task-oriented answers over generic explanations.",
                    "For factual uncertainty, state the uncertainty explicitly.",
                ]),
                section("TOOL_AND_REASONING_POLICY", [
                    "Before complex or multi-step tasks, use planning_tool if it is available to plan the work.",
                    "If the answer depends on missing user preferences, constraints, dates, inputs, or decisions, use ask_tool if it is available.",
                    "When using ask_tool, ask 1-3 short precise questions at once. Each question must request exactly one missing fact.",
                    "For categorical or example-driven questions, include 3-6 short selectAnswers so the user can answer with one tap.",
                    "Avoid long introductions, avoid combining unrelated asks in one question, and include answer options only when they materially speed up the reply.",
                    "Do not ask unnecessary clarifying questions when the answer can already be completed with high confidence.",
                    "When using a plan, you must complete all of the stages before generating final answer. DON'T ANSWERING BEFOR COMPLETING ALL THE STAGES",
                    "If the plan is completed, continue with final result synthesis instead of creating duplicate plans.",
                ]),
                section("RESPONSE_QUALITY", [
                    "Answer the user's actual request first and keep the response focused on the requested outcome.",
                    "Use clear structure when it improves readability, but avoid bloated formatting.",
                    "When giving recommendations, prefer actionable and specific guidance.",
                    "When the task is complex, break the solution into coherent steps internally and present a concise result.",
                ]),
            ]);
        })(),
        agentToolsSet: ["web_search", "web_fetch", "planning_tool", "ask_tool"],
        chatLabel: "Агент",
        chatIcon: "mdi:robot-outline",
        chatPlaceholder: "Попросите агента что-нибудь сделать...",
        isEditable: false,
        modelProvider: "", // Заполняется во время использования из поля profileStore.generalData.chatGenProvider
        modelBaseUrl: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].baseUrl
        modelName: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].modelName
        modelApiKey: "", // Заполняется во время использования из поля profileStore.secureData.chatGenProviders[profileStore.generalData.chatGenProvider].apiKey
    },
};
