export type DialogId = `dlg-${string}`;

export type DialogContextMessage = {
    role: "user" | "assistant";
    content: string;
};

export type DialogUiMessage = {
    id: `msg-${string}`;
    role: "user" | "assistant";
    answeringAt?: string;
    content: string;
    reasoning?: string;
    timestamp: string;
    status: "streaming" | "done" | "error";
};

export interface DialogEntity {
    id: DialogId;
    name: string;
    is_for_project: boolean;
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
}

export type CreateDialogDto = {
    id: DialogId;
    name: string;
    is_for_project: boolean;
};

export type UpdateDialogStateDto = {
    ui_messages: DialogUiMessage[];
    context_messages: DialogContextMessage[];
    token_usage: unknown;
};
