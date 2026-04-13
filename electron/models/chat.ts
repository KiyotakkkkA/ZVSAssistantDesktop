export type ChatRole = "user" | "assistant" | "system";

export type ChatImageAttachment = {
    id: `img-${string}`;
    fileName: string;
    extension: string;
    mimeType: string;
    size: number;
    dataUrl: string;
};

export type ChatRequestContentPart =
    | {
          type: "text";
          text: string;
      }
    | {
          type: "image";
          image: string;
          mediaType: string;
      };

export type ChatRequestMessage = {
    role: ChatRole;
    content: ChatRequestContentPart[];
};

export type ResponseGenParams = {
    prompt?: string;
    messages?: ChatRequestMessage[];
    dialogId?: string;
    toolPackIds?: string[];
    enabledToolNames?: string[];
};
