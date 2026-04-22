import { Icon } from "@iconify/react";
import { Button, InputBig } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { ChatImageAttachment } from "../../../../../electron/models/chat";
import { ChatUserAttachmentCard } from "./ChatUserAttachmentCard";

type ChatUserBubbleCardProps = {
    content: string;
    attachments?: ChatImageAttachment[];
    timestamp?: string;
    msgDelete?: () => void;
    msgEdit?: () => void;
    msgCopy?: () => void;
    msgRetry?: () => void;
    isEditing?: boolean;
    editValue?: string;
    onEditValueChange?: (value: string) => void;
    onEditConfirm?: () => void;
    onEditCancel?: () => void;
};

export function ChatUserBubbleCard({
    content,
    attachments = [],
    timestamp,
    msgDelete,
    msgEdit,
    msgCopy,
    msgRetry,
    isEditing = false,
    editValue = "",
    onEditValueChange,
    onEditConfirm,
    onEditCancel,
}: ChatUserBubbleCardProps) {
    return (
        <article className="flex flex-col w-fit group">
            {attachments.length > 0 && !isEditing && (
                <div className="mb-2 flex max-w-[88%] justify-end gap-2 self-end">
                    {attachments.map((attachment) => (
                        <ChatUserAttachmentCard
                            key={attachment.id}
                            attachment={attachment}
                        />
                    ))}
                </div>
            )}

            <div className="max-w-[88%] self-end rounded-2xl bg-main-500/20 px-4 py-3 text-sm leading-relaxed text-main-100 ring-main-300/30">
                {isEditing ? (
                    <div className="space-y-3">
                        <InputBig
                            value={editValue}
                            onChange={(value) =>
                                onEditValueChange?.(value.target.value)
                            }
                            className="h-24 rounded-xl border border-main-600 bg-main-800/85 px-3 py-2 text-sm text-main-100"
                        />

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                shape="rounded-lg"
                                className="h-8 px-3 text-xs"
                                onClick={onEditCancel}
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="primary"
                                shape="rounded-lg"
                                className="h-8 px-3 text-xs flex-1"
                                onClick={onEditConfirm}
                            >
                                Отправить
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {content.trim().length > 0 ? (
                            <p className="whitespace-pre-wrap wrap-break-word">
                                {content}
                            </p>
                        ) : null}
                    </div>
                )}
                {timestamp ? (
                    <p className="mt-2 text-[11px] text-main-400">
                        {timestamp}
                    </p>
                ) : null}
            </div>

            <div className="mt-2 mr-2 flex justify-end gap-2">
                {!isEditing ? (
                    <>
                        <Button
                            variant=""
                            className="border-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={msgRetry}
                        >
                            <Icon
                                icon="mdi:refresh"
                                className="text-main-400 transition-colors hover:text-main-300"
                            />
                        </Button>
                        <Button
                            variant=""
                            className="border-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={msgCopy}
                        >
                            <Icon
                                icon="mdi:content-copy"
                                className="text-main-400 transition-colors hover:text-main-300"
                            />
                        </Button>
                        <Button
                            variant=""
                            className="border-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={msgEdit}
                        >
                            <Icon
                                icon="mdi:pencil"
                                className="text-main-400 transition-colors hover:text-main-300"
                            />
                        </Button>
                    </>
                ) : null}
                <Button
                    variant=""
                    className="border-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={msgDelete}
                >
                    <Icon
                        icon="mdi:delete"
                        className="text-main-400 transition-colors hover:text-red-300"
                    />
                </Button>
            </div>
        </article>
    );
}
