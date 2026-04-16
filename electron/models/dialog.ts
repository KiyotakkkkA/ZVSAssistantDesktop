import {
    DialogIdFormat,
    MsgIdFormat,
    StageIdFormat,
} from "../../src/utils/creators";
import type { ChatRole } from "./chat";
import type { ChatImageAttachment } from "./chat";
import type { VecstoreSearchResult } from "./chat";
import type { ToolTrace } from "./tool";

export type DialogContextMessage = {
    role: ChatRole;
    content: string;
    attachments?: ChatImageAttachment[];
};

export type AssistantMessageStage =
    | {
          id: StageIdFormat;
          type: "reasoning";
          content: string;
      }
    | {
          id: StageIdFormat;
          type: "answer";
          content: string;
      }
    | {
          id: StageIdFormat;
          type: "tool";
          toolCallId: string;
      };

export type DialogUiMessage = {
    id: MsgIdFormat;
    role: ChatRole;
    answeringAt?: string;
    content: string;
    attachments?: ChatImageAttachment[];
    sources?: VecstoreSearchResult[];
    reasoning?: string;
    toolTraces?: ToolTrace[];
    stages?: AssistantMessageStage[];
    timestamp: string;
    status: "streaming" | "done" | "error";
};

export interface DialogEntity {
    id: DialogIdFormat;
    owner_id: string;
    name: string | null;
    vecstore_id: string | null;
    is_for_project: boolean;
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
}

export type CreateDialogDto = {
    id: DialogIdFormat;
    owner_id: string;
    name: string | null;
    vecstore_id?: string | null;
    is_for_project: boolean;
};

export type UpdateDialogStateDto = {
    id: DialogIdFormat;
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
};
