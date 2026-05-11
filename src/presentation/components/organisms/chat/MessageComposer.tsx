import { Icon } from "@iconify/react";
import {
    Button,
    Dropdown,
    Floating,
    InputBig,
    Modal,
    Separator,
} from "@kiyotakkkka/zvs-uikit-lib/ui";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import type { ChatImageAttachment } from "../../../../../electron/models/chat";
import type { BuiltInAssistantMode } from "../../../../../electron/models/user";
import {
    baseModelEntries,
    canUseAgentTools,
    getBaseModel,
} from "../../../../data/BaseModels";
import { useUpload } from "../../../../hooks";
import { profileStore } from "../../../../stores/profileStore";
import { storageStore } from "../../../../stores/storageStore";
import { workspaceStore } from "../../../../stores/workspaceStore";
import { convertBytesToSize } from "../../../../utils/converters";
import { ChatRequiredToolsPickForm, ChatVecstoresPickForm } from "../forms";

type MessageComposerProps = {
    input: string;
    setInput: (value: string) => void;
    onSubmit: (options?: {
        attachments?: ChatImageAttachment[];
        mode?: BuiltInAssistantMode | string;
    }) => Promise<boolean>;
    isGenerating: boolean;
};

export const MessageComposer = observer(
    ({ input, setInput, onSubmit, isGenerating }: MessageComposerProps) => {
        const areaRef = useRef<HTMLTextAreaElement>(null);
        const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
        const [isVecstoresModalOpen, setIsVecstoresModalOpen] = useState(false);
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
        const activeMode =
            profileStore.user?.generalData.selectedAssistantMode ?? "chat";
        const activeModel = getBaseModel(activeMode);

        const handleModeChange = (mode: BuiltInAssistantMode | string) => {
            profileStore.updateGeneralData({ selectedAssistantMode: mode });
            workspaceStore.setSelectedAssistantMode(mode);
        };

        const handleSubmit = async () => {
            const isStarted = await onSubmit({
                attachments,
                mode: activeMode,
            });

            if (isStarted) {
                clearAttachments();
            }
        };

        useEffect(() => {
            if (!isVecstoresModalOpen) {
                return;
            }

            void storageStore.refreshStorageState();
        }, [isVecstoresModalOpen]);

        const handleVecstoreSelect = (vecstoreId: string | null) => {
            const activeDialogId = workspaceStore.activeDialogId;

            if (!activeDialogId) {
                return;
            }

            void workspaceStore.updateDialogVecstore(
                activeDialogId,
                vecstoreId,
            );
            setIsVecstoresModalOpen(false);
        };

        return (
            <>
                <footer className="shrink-0 rounded-2xl pt-2">
                    <div
                        className="mx-auto w-full max-w-5xl rounded-[1.75rem] border border-main-700/70 bg-main-800/65 p-1 hover:border-main-600/90 transition-colors hover:cursor-text animate-card-rise-in animate-soft-pulse-glow"
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
                                                    {attachment.extension ||
                                                        "img"}
                                                </p>
                                                <p className="text-[11px] text-main-400">
                                                    {convertBytesToSize(
                                                        attachment.size,
                                                    )}
                                                </p>
                                            </div>

                                            <Button
                                                variant="secondary"
                                                className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 transition-opacity group-hover/attachment:opacity-100"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    removeAttachment(
                                                        attachment.id,
                                                    );
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
                                onChange={(value) =>
                                    setInput(value.target.value)
                                }
                                placeholder={activeModel.chatPlaceholder}
                                className="h-auto! min-h-9 w-full rounded-lg border-0 bg-transparent p-2 text-main-100 placeholder:text-main-400 focus-visible:ring-0"
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" &&
                                        !event.shiftKey
                                    ) {
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
                                        variant="secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsVecstoresModalOpen(true);
                                        }}
                                    >
                                        <Icon icon="mdi:storage" />
                                    </Button>
                                    {canUseAgentTools(activeMode) && (
                                        <Button
                                            label="Tools"
                                            className="h-9 w-9 p-0"
                                            shape="rounded-md"
                                            variant="primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsToolsModalOpen(true);
                                            }}
                                        >
                                            <Icon icon="mdi:tools" />
                                        </Button>
                                    )}

                                    <Dropdown
                                        menuPlacement="top-left"
                                        menuWidth={250}
                                    >
                                        <Dropdown.Trigger
                                            className="rounded-r-full bg-main-700 hover:bg-main-600 transition-color min-h-0 p-1.5"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                            }}
                                            placeholder=""
                                            icon={false}
                                        >
                                            <Icon
                                                className="text-main-50"
                                                icon="mdi:paperclip"
                                                width={22}
                                                height={22}
                                            />
                                        </Dropdown.Trigger>

                                        <Dropdown.Menu className="border border-main-700/80 bg-main-900 shadow-xl space-y-2">
                                            {attachOptions.map((option) => (
                                                <Dropdown.Item
                                                    key={option.value}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        option.onClick();
                                                    }}
                                                    icon={option.icon}
                                                >
                                                    {option.label}
                                                </Dropdown.Item>
                                            ))}
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Floating
                                        anchor="top-right"
                                        className="inline-flex"
                                        classNames={{
                                            panel: "mb-2 border-0 bg-transparent p-0 shadow-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto",
                                            content:
                                                "rounded-xl bg-main-900/92 p-1.5 border border-main-700/70 backdrop-blur-md",
                                        }}
                                        content={
                                            <div
                                                className="flex min-w-44 flex-col gap-1"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                }}
                                            >
                                                {baseModelEntries.map(([modeKey, model]) => {
                                                    const isActive =
                                                        model.id === activeModel.id;

                                                    return (
                                                        <Button
                                                            key={model.id}
                                                            type="button"
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                            }}
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                handleModeChange(
                                                                    modeKey,
                                                                );
                                                            }}
                                                            variant=""
                                                            shape="rounded-lg"
                                                            className={`group/aimode inline-flex h-9 px-2.5 text-[12px] border-transparent w-full justify-start ${
                                                                isActive
                                                                    ? "bg-main-700/70 text-main-50"
                                                                    : "text-main-300 hover:bg-main-700/45 hover:text-main-100"
                                                            }`}
                                                        >
                                                            <div className="flex justify-between w-full">
                                                                <span className="inline-flex items-center gap-2">
                                                                    <Icon
                                                                        icon={
                                                                            model.chatIcon
                                                                        }
                                                                        width={
                                                                            14
                                                                        }
                                                                        height={
                                                                            14
                                                                        }
                                                                    />
                                                                    {
                                                                        model.chatLabel
                                                                    }
                                                                </span>
                                                                {isActive ? (
                                                                    <Icon
                                                                        icon="mdi:check"
                                                                        width={
                                                                            18
                                                                        }
                                                                        height={
                                                                            18
                                                                        }
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        </Button>
                                                    );
                                                })}
                                                <Separator className="my-1 border-main-700/30" />
                                                <Button
                                                    type="button"
                                                    variant=""
                                                    className="border-transparent"
                                                >
                                                    <span className="inline-flex items-center gap-2 text-[12px] text-main-300 hover:text-main-100 py-1">
                                                        <Icon
                                                            icon="mdi:plus-circle"
                                                            width="14"
                                                            height="14"
                                                        />
                                                        Добавить агента
                                                    </span>
                                                </Button>
                                            </div>
                                        }
                                    >
                                        <Button
                                            type="button"
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-main-700/70 text-main-200 transition-colors hover:bg-main-600/80"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                            }}
                                            title={`Агент: ${activeModel.chatLabel}`}
                                            aria-label={`Агент: ${activeModel.chatLabel}`}
                                        >
                                            <Icon
                                                icon={`${activeModel.chatIcon}`}
                                            />
                                        </Button>
                                    </Floating>

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
                    open={isVecstoresModalOpen}
                    onClose={() => setIsVecstoresModalOpen(false)}
                    className="max-w-3xl"
                >
                    <Modal.Header className="text-main-100">
                        Выбор векторного хранилища
                    </Modal.Header>

                    <Modal.Content>
                        <ChatVecstoresPickForm
                            selectedVecstoreId={
                                workspaceStore.activeDialogVecstoreId
                            }
                            onSelectVecstore={handleVecstoreSelect}
                        />
                    </Modal.Content>

                    <Modal.Footer>
                        <Button
                            type="button"
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => handleVecstoreSelect(null)}
                            disabled={!workspaceStore.activeDialogVecstoreId}
                        >
                            Сбросить
                        </Button>
                    </Modal.Footer>
                </Modal>

                <Modal
                    open={isToolsModalOpen}
                    onClose={() => setIsToolsModalOpen(false)}
                    className="max-w-6xl min-h-144"
                >
                    <Modal.Header className="text-main-100">
                        Настройка инструментов
                    </Modal.Header>

                    <Modal.Content>
                        <ChatRequiredToolsPickForm
                            toolsQuery={toolsQuery}
                            onToolsQueryChange={setToolsQuery}
                        />
                    </Modal.Content>
                </Modal>
            </>
        );
    },
);
