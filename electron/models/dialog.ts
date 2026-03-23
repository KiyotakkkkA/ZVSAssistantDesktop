import type { ChatRole } from "./chat";
import type { ToolTrace } from "./tool";

export type DialogId = `dlg-${string}`;

export type DialogContextMessage = {
    role: ChatRole;
    content: string;
};

export type AssistantMessageStage =
    | {
          id: `stg-${string}`;
          type: "reasoning";
          content: string;
      }
    | {
          id: `stg-${string}`;
          type: "answer";
          content: string;
      }
    | {
          id: `stg-${string}`;
          type: "tool";
          toolCallId: string;
      };

export type DialogUiMessage = {
    id: `msg-${string}`;
    role: ChatRole;
    answeringAt?: string;
    content: string;
    reasoning?: string;
    toolTraces?: ToolTrace[];
    stages?: AssistantMessageStage[];
    timestamp: string;
    status: "streaming" | "done" | "error";
};

export interface DialogEntity {
    id: DialogId;
    owner_id: string;
    name: string | null;
    is_for_project: boolean;
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
}

export type CreateDialogDto = {
    id: DialogId;
    owner_id: string;
    name: string | null;
    is_for_project: boolean;
};

export type UpdateDialogStateDto = {
    id: DialogId;
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
};
