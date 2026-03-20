import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    timestamp: string;
    status: "streaming" | "done" | "error";
};

const DEFAULT_MODEL = "gpt-oss:120b";

const createId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const formatTime = () =>
    new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

const normalizeText = (value: unknown, fallback = ""): string => {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Error) {
        return value.message || fallback;
    }

    if (value == null) {
        return fallback;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export const useChat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    const activeRequestIdRef = useRef<string | null>(null);

    const applyAssistantDelta = useCallback((delta: unknown) => {
        const chunk = normalizeText(delta);

        if (!chunk) {
            return;
        }

        setMessages((current) => {
            const next = [...current];
            const assistantIndex = next
                .map((message) => message.role)
                .lastIndexOf("assistant");

            if (assistantIndex < 0) {
                return current;
            }

            const assistantMessage = next[assistantIndex];
            next[assistantIndex] = {
                ...assistantMessage,
                content: assistantMessage.content + chunk,
            };

            return next;
        });
    }, []);

    const applyAssistantReasoningDelta = useCallback((delta: unknown) => {
        const chunk = normalizeText(delta);

        if (!chunk) {
            return;
        }

        setMessages((current) => {
            const next = [...current];
            const assistantIndex = next
                .map((message) => message.role)
                .lastIndexOf("assistant");

            if (assistantIndex < 0) {
                return current;
            }

            const assistantMessage = next[assistantIndex];
            next[assistantIndex] = {
                ...assistantMessage,
                reasoning: `${assistantMessage.reasoning ?? ""}${chunk}`,
            };

            return next;
        });
    }, []);

    const markAssistantAs = useCallback(
        (status: ChatMessage["status"], fallbackText?: unknown) => {
            setMessages((current) => {
                const next = [...current];
                const assistantIndex = next
                    .map((message) => message.role)
                    .lastIndexOf("assistant");

                if (assistantIndex < 0) {
                    return current;
                }

                const assistantMessage = next[assistantIndex];
                const fallback = normalizeText(fallbackText);
                next[assistantIndex] = {
                    ...assistantMessage,
                    status,
                    content:
                        assistantMessage.content ||
                        fallback ||
                        assistantMessage.content,
                };

                return next;
            });
        },
        [],
    );

    useEffect(() => {
        if (!window.chat?.onStreamEvent) {
            return;
        }

        const unsubscribe = window.chat.onStreamEvent(({ requestId, part }) => {
            if (
                !activeRequestIdRef.current ||
                activeRequestIdRef.current !== requestId
            ) {
                return;
            }

            if (part.type === "text-delta") {
                applyAssistantDelta(part.text);
                return;
            }

            if (part.type === "reasoning-delta") {
                applyAssistantReasoningDelta(part.text);
                return;
            }

            if (part.type === "error") {
                markAssistantAs(
                    "error",
                    part.error ?? "Ошибка генерации ответа",
                );
                activeRequestIdRef.current = null;
                setIsGenerating(false);
                return;
            }

            if (part.type === "finish" || part.type === "usage") {
                markAssistantAs("done");
                activeRequestIdRef.current = null;
                setIsGenerating(false);
            }
        });

        return unsubscribe;
    }, [applyAssistantDelta, applyAssistantReasoningDelta, markAssistantAs]);

    const sendMessage = useCallback(async () => {
        if (isGenerating) {
            return;
        }

        const prompt = input.trim();

        if (!prompt) {
            return;
        }

        const requestId = createId();
        activeRequestIdRef.current = requestId;

        setMessages((current) => [
            ...current,
            {
                id: createId(),
                role: "user",
                content: prompt,
                timestamp: formatTime(),
                status: "done",
            },
            {
                id: createId(),
                role: "assistant",
                content: "",
                reasoning: "",
                timestamp: formatTime(),
                status: "streaming",
            },
        ]);

        setInput("");
        setIsGenerating(true);

        try {
            if (window.chat?.streamResponseGeneration) {
                window.chat.streamResponseGeneration({
                    requestId,
                    prompt,
                    model: DEFAULT_MODEL,
                });
                return;
            }

            if (window.chat?.generateResponse) {
                const response = await window.chat.generateResponse({
                    prompt,
                    model: DEFAULT_MODEL,
                });

                markAssistantAs("done", response.text);
                activeRequestIdRef.current = null;
                setIsGenerating(false);
                return;
            }

            throw new Error("Chat API is not available in preload");
        } catch (error) {
            markAssistantAs(
                "error",
                error instanceof Error
                    ? error.message
                    : "Не удалось отправить запрос",
            );
            activeRequestIdRef.current = null;
            setIsGenerating(false);
        }
    }, [input, isGenerating, markAssistantAs]);

    const clearChat = useCallback(() => {
        activeRequestIdRef.current = null;
        setIsGenerating(false);
        setMessages([]);
    }, []);

    return {
        messages,
        input,
        isGenerating,
        setInput,
        sendMessage,
        clearChat,
    };
};
