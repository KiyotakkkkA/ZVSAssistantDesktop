import { Icon } from "@iconify/react";
import {
    Button,
    Dropdown,
    InputBig,
    Modal,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useRef, useState } from "react";
import type { ChatImageAttachment } from "../../../../../electron/models/chat";
import { useUpload } from "../../../../hooks";
import { formatFileSize } from "../../../../utils/chat/imageUploadStrategies";
import { RequiredToolsPickForm } from "./forms";

type MessageComposerProps = {
    input: string;
    setInput: (value: string) => void;
    onSubmit: (options?: {
        attachments?: ChatImageAttachment[];
    }) => Promise<boolean>;
    isGenerating: boolean;
};

export const MessageComposer = ({
    input,
    setInput,
    onSubmit,
    isGenerating,
}: MessageComposerProps) => {
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    const [toolsQuery, setToolsQuery] = useState("");
    const {
        attachments,
        accept,
        inputRef,
        openPicker,
        removeAttachment,
        clearAttachments,
        onInputChange,
    } = useUpload();

    const attachOptions = [
        {
            value: "attach-image",
            label: "Прикрепить изображение",
            icon: <Icon icon="mdi:image-outline" width="16" height="16" />,
            onClick: () => {
                openPicker();
            },
        },
    ];

    const canSubmit = input.trim().length > 0 || attachments.length > 0;

    const handleSubmit = async () => {
        const isStarted = await onSubmit({
            attachments,
        });

        if (isStarted) {
            clearAttachments();
        }
    };

    return (
        <>
            <footer className="shrink-0 rounded-2xl pt-2">
                <div
                    className="mx-auto w-full max-w-5xl rounded-[1.75rem] border border-main-700/70 bg-main-800/65 p-1 hover:border-main-600/90 group transition-colors hover:cursor-text animate-card-rise-in animate-soft-pulse-glow"
                    onClick={() => {
                        areaRef.current?.focus();
                    }}
                >
                    <div className="relative rounded-2xl px-3 py-2">
                        <input
                            ref={inputRef}
                            type="file"
                            accept={accept}
                            multiple
                            className="hidden"
                            onChange={onInputChange}
                        />

                        {attachments.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {attachments.map((attachment) => (
                                    <div
                                        key={attachment.id}
                                        className="group/attachment relative flex h-19 w-40 overflow-hidden rounded-xl border border-main-500/30 bg-main-900/80"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            window.open(
                                                attachment.dataUrl,
                                                "_blank",
                                                "noopener,noreferrer",
                                            );
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                window.open(
                                                    attachment.dataUrl,
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                );
                                            }
                                        }}
                                    >
                                        <img
                                            src={attachment.dataUrl}
                                            alt={attachment.fileName}
                                            className="h-full w-20 object-cover"
                                        />

                                        <div className="min-w-0 flex-1 px-2 py-1">
                                            <p className="truncate text-[12px] text-main-100">
                                                {attachment.fileName}
                                            </p>
                                            <p className="text-[11px] text-main-400 uppercase">
                                                {attachment.extension || "img"}
                                            </p>
                                            <p className="text-[11px] text-main-400">
                                                {formatFileSize(
                                                    attachment.size,
                                                )}
                                            </p>
                                        </div>

                                        <Button
                                            variant="secondary"
                                            className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 transition-opacity group-hover/attachment:opacity-100"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeAttachment(attachment.id);
                                            }}
                                        >
                                            <Icon
                                                icon="mdi:close"
                                                width="14"
                                                height="14"
                                            />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <InputBig
                            ref={areaRef}
                            value={input}
                            onChange={(value) => setInput(value.target.value)}
                            placeholder="Задайте вопрос..."
                            className="h-auto! min-h-9 w-full rounded-lg border-0 bg-transparent p-2 text-main-100 placeholder:text-main-400 focus-visible:ring-0"
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void handleSubmit();
                                }
                            }}
                        />

                        <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    label="Tools"
                                    className="h-9 w-9 p-0"
                                    shape="rounded-l-full"
                                    variant="primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsToolsModalOpen(true);
                                    }}
                                >
                                    <Icon icon="mdi:tools" />
                                </Button>

                                <Button
                                    label="Tools"
                                    className="h-9 w-9 p-0"
                                    shape="rounded-sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    <Icon icon="mdi:script" />
                                </Button>

                                <Dropdown
                                    options={attachOptions}
                                    menuPlacement="top"
                                    classNames={{
                                        menu: "w-66",
                                    }}
                                    renderTrigger={({
                                        toggleOpen,
                                        triggerRef,
                                        disabled,
                                        ariaProps,
                                    }) => (
                                        <Button
                                            label="Attach"
                                            variant="primary"
                                            className="h-9 w-9 p-0"
                                            shape="rounded-r-full"
                                            ref={triggerRef}
                                            disabled={disabled}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleOpen();
                                            }}
                                            {...ariaProps}
                                        >
                                            <Icon icon={"mdi:paperclip"} />
                                        </Button>
                                    )}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    className="h-9 w-9 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    <Icon icon="mdi:microphone" />
                                </Button>

                                <Button
                                    className="h-9 w-9 p-0"
                                    variant="primary"
                                    disabled={isGenerating || !canSubmit}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleSubmit();
                                    }}
                                >
                                    <Icon
                                        icon={
                                            isGenerating
                                                ? "mdi:progress-clock"
                                                : "mdi:send"
                                        }
                                    />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            <Modal
                open={isToolsModalOpen}
                onClose={() => setIsToolsModalOpen(false)}
                title="Настройка инструментов"
                className="max-w-6xl min-h-144"
            >
                <RequiredToolsPickForm
                    toolsQuery={toolsQuery}
                    onToolsQueryChange={setToolsQuery}
                />
            </Modal>
        </>
    );
};
