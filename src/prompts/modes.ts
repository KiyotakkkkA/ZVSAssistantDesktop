import type { BuiltInAssistantMode } from "../../electron/models/user";

export type AssistantModeConfig = {
    key: BuiltInAssistantMode | string;
    label: string;
    icon: string;
    placeholder: string;
};

export const assistantModes: AssistantModeConfig[] = [
    {
        key: "chat",
        label: "Чат",
        icon: "mdi:message-text-outline",
        placeholder: "Задайте вопрос...",
    },
    {
        key: "planning",
        label: "Планирование",
        icon: "mdi:timeline-text-outline",
        placeholder: "Опишите цель и получите план...",
    },
    {
        key: "agent",
        label: "Агент",
        icon: "mdi:robot-outline",
        placeholder: "Поручите задачу агенту...",
    },
];

export const getAssistantModeByKey = (key: BuiltInAssistantMode | string) => {
    return assistantModes.find((mode) => mode.key === key) ?? assistantModes[0];
};
