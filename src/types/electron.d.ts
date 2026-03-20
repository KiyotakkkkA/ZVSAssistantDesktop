export {};

declare global {
    interface Window {
        chat?: {
            generateResponse: (params: {
                prompt: string;
                model: string;
                messages?: Array<{
                    role: "user" | "assistant";
                    content: string;
                }>;
            }) => Promise<{
                text: string;
                usage: unknown;
            }>;
            streamResponseGeneration: (params: {
                requestId: string;
                prompt: string;
                model: string;
                messages?: Array<{
                    role: "user" | "assistant";
                    content: string;
                }>;
            }) => void;
            onStreamEvent: (
                listener: (payload: {
                    requestId: string;
                    part: {
                        type: string;
                        text?: string;
                        error?: string;
                    };
                }) => void,
            ) => () => void;
        };
    }
}
