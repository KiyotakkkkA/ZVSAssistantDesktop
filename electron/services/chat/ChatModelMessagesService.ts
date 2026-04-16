import type { ModelMessage } from "ai";
import type {
    ChatRequestContentPart,
    ChatRequestMessage,
    ResponseGenParams,
} from "../../models/chat";

const getTextFromParts = (parts: ChatRequestContentPart[]) => {
    return parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
};

const toUserContentParts = (parts: ChatRequestContentPart[]) => {
    return parts.map((part) => {
        if (part.type === "text") {
            return {
                type: "text" as const,
                text: part.text,
            };
        }

        return {
            type: "image" as const,
            image: part.image,
            mediaType: part.mediaType,
        };
    });
};

const toModelMessage = (message: ChatRequestMessage): ModelMessage => {
    if (message.role === "user") {
        return {
            role: "user",
            content: toUserContentParts(message.content),
        };
    }

    return {
        role: message.role,
        content: getTextFromParts(message.content),
    };
};

export class ChatModelMessagesService {
    toModelMessages(params: ResponseGenParams): ModelMessage[] {
        if (params.messages && params.messages.length > 0) {
            return params.messages.map(toModelMessage);
        }

        return [
            {
                role: "user" as const,
                content: [
                    {
                        type: "text" as const,
                        text: params.prompt ?? "",
                    },
                ],
            },
        ];
    }
}
