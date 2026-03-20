import type { IpcMainEvent } from "electron";

import type {
    ChatGenService,
    ResponseGenParams,
} from "../services/ChatGenService";
import { handleIpc, onIpcWithEvent } from "./ipcUtils";

export type IpcChatPackDeps = {
    chatGenService: ChatGenService;
};

const sendStreamError = (
    event: IpcMainEvent,
    requestId: string,
    error: string,
) => {
    event.sender.send("chat:stream:event", {
        requestId,
        part: {
            type: "error",
            error,
        },
    });
};

export const registerIpcChatPack = ({ chatGenService }: IpcChatPackDeps) => {
    handleIpc("chat:generate", async (payload: ResponseGenParams) => {
        const prompt = payload.prompt?.trim() ?? "";
        const model = payload.model;
        const messages = payload.messages;

        if (!prompt && (!messages || messages.length === 0)) {
            throw new Error("Prompt is required");
        }

        return chatGenService.generateResponse({
            prompt,
            model,
            messages,
        });
    });

    onIpcWithEvent(
        "chat:stream:start",
        (event, payload: ResponseGenParams & { requestId: string }) => {
            const prompt = payload.prompt?.trim() ?? "";
            const requestId = payload.requestId;
            const model = payload.model;
            const messages = payload.messages;

            if (
                (!prompt && (!messages || messages.length === 0)) ||
                !requestId
            ) {
                sendStreamError(
                    event,
                    requestId,
                    "Prompt and requestId are required",
                );
                return;
            }

            void (async () => {
                try {
                    const result = chatGenService.streamResponseGeneration({
                        prompt,
                        model,
                        messages,
                    });

                    for await (const part of result.fullStream) {
                        event.sender.send("chat:stream:event", {
                            requestId,
                            part,
                        });
                    }

                    const usage = await result.getTotalUsage();
                    event.sender.send("chat:stream:event", {
                        requestId,
                        part: {
                            type: "usage",
                            usage,
                        },
                    });
                } catch (error) {
                    sendStreamError(
                        event,
                        requestId,
                        error instanceof Error
                            ? error.message
                            : "Unknown stream error",
                    );
                }
            })();
        },
    );
};
