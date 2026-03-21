import type { ResponseGenParams } from "../../electron/models/chat";
import type {
    DialogContextMessage,
    DialogEntity,
    DialogId,
} from "../../electron/models/dialog";
import type { ProfileBootPayload } from "../../electron/models/profile";
import type { UpdateUserDto } from "../../electron/models/user";
import type { ThemeData } from "../../electron/static/themes/types";

export {};

export type PersistedDialog = DialogEntity;

declare global {
    interface Window {
        chat: {
            generateResponse: (params: ResponseGenParams) => Promise<{
                text: string;
                usage: unknown;
            }>;
            streamResponseGeneration: (
                params: ResponseGenParams & {
                    requestId: string;
                },
            ) => void;
            onStreamEvent: (
                listener: (payload: {
                    requestId: string;
                    part: {
                        type: string;
                        text?: string;
                        error?: string;
                        usage?: unknown;
                    };
                }) => void,
            ) => () => void;
        };
        profile: {
            boot: () => Promise<ProfileBootPayload>;
            update: (
                id: string,
                data: UpdateUserDto,
            ) => Promise<ProfileBootPayload>;
            getThemeData: (themeName: string) => Promise<ThemeData>;
        };
        workspace: {
            getDialogs: () => Promise<PersistedDialog[]>;
            createDialog: (
                id: DialogId,
                name: string,
                isForProject: boolean,
            ) => Promise<PersistedDialog>;
            renameDialog: (id: DialogId, name: string) => Promise<void>;
            deleteDialog: (id: DialogId) => Promise<void>;
            updateDialogMessages: (
                id: DialogId,
                uiMessages: DialogEntity["ui_messages"],
                contextMessages: DialogContextMessage[],
                tokenUsage: DialogEntity["token_usage"],
            ) => Promise<void>;
        };
    }
}
