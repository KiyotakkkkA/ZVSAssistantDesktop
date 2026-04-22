import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";
import type { ChatImageAttachment } from "../../../../../electron/models/chat";
import { ImagePreviewBlock } from "../render";

type ChatUserAttachmentCardProps = {
    attachment: ChatImageAttachment;
};

export function ChatUserAttachmentCard({
    attachment,
}: ChatUserAttachmentCardProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    return (
        <div className="group/attachment relative h-28 w-28 overflow-hidden rounded-2xl border border-main-300/20 bg-main-100/90 p-1">
            <img
                src={attachment.dataUrl}
                alt={attachment.fileName}
                className="h-full w-full rounded-xl object-cover"
            />

            <Button
                variant="secondary"
                className="absolute right-2 top-2 h-7 w-7 p-0 opacity-85 transition-opacity group-hover/attachment:opacity-100"
                onClick={(event) => {
                    event.stopPropagation();
                    setIsPreviewOpen(true);
                }}
            >
                <Icon icon="mdi:image-outline" width="15" height="15" />
            </Button>

            <ImagePreviewBlock
                src={attachment.dataUrl}
                title={attachment.fileName}
                downloadFileName={attachment.fileName}
                expanded={isPreviewOpen}
                onExpandedChange={setIsPreviewOpen}
                showInlinePreview={false}
            />
        </div>
    );
}
