export {};

declare global {
    interface Window {
        chat?: {
            generateResponse: (params: {
                prompt: string;
                model: string;
            }) => Promise<{
                text: string;
                usage: unknown;
            }>;
            streamResponseGeneration: (params: {
                requestId: string;
                prompt: string;
                model: string;
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
