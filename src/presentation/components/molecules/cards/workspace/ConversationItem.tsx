import { Icon } from "@iconify/react";
import { Button } from "../../../atoms";
import { WorkspaceListItem } from "./WorkspaceListItem";

type ConversationItemProps = {
    id: string;
    title: string;
    preview: string;
    time: string;
    tokenUsage?: {
        totalTokens: number;
    };
    active?: boolean;
    onSelect: (dialogId: string) => void;
    onRename: (dialogId: string) => void;
    onDelete: (dialogId: string) => void;
    canDelete: boolean;
};

const iconBtnClass =
    "border-transparent items-center justify-center rounded-lg cursor-pointer text-base text-main-300 hover:bg-main-700/70 hover:text-main-100";

export function ConversationItem({
    id,
    title,
    preview,
    time,
    tokenUsage,
    active = false,
    onSelect,
    onRename,
    onDelete,
    canDelete,
}: ConversationItemProps) {
    const totalTokens =
        typeof tokenUsage?.totalTokens === "number"
            ? Math.max(0, Math.floor(tokenUsage.totalTokens))
            : 0;

    return (
        <WorkspaceListItem
            id={id}
            title={title}
            preview={preview}
            active={active}
            onSelect={onSelect}
            actions={
                <div className="flex items-center gap-2">
                    <span className="text-xs text-main-500">
                        {totalTokens.toLocaleString("ru-RU")} tok
                    </span>
                    <span className="text-xs text-main-400">{time}</span>
                    <Button
                        variant=""
                        className={iconBtnClass}
                        onClick={(event) => {
                            event.stopPropagation();
                            onRename(id);
                        }}
                        aria-label="Переименовать диалог"
                    >
                        <Icon
                            icon="mdi:pencil-outline"
                            width="16"
                            height="16"
                        />
                    </Button>
                    <Button
                        variant=""
                        className={`${iconBtnClass} disabled:cursor-not-allowed disabled:opacity-40`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete(id);
                        }}
                        disabled={!canDelete}
                        aria-label="Удалить диалог"
                    >
                        <Icon
                            icon="mdi:trash-can-outline"
                            width="16"
                            height="16"
                        />
                    </Button>
                </div>
            }
        />
    );
}
