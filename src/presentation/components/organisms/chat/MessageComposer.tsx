import { Icon } from "@iconify/react";
import { Button, Dropdown, InputBig } from "@kiyotakkkka/zvs-uikit-lib";
import { useRef } from "react";

type MessageComposerProps = {
    input: string;
    setInput: (value: string) => void;
    onSubmit: () => void;
    isGenerating: boolean;
};

const attachOptions = [
    {
        value: "attach-image",
        label: "Прикрепить изображение",
        icon: <Icon icon="mdi:image-outline" width="16" height="16" />,
        onClick: () => {},
    },
];

export const MessageComposer = ({
    input,
    setInput,
    onSubmit,
    isGenerating,
}: MessageComposerProps) => {
    const areaRef = useRef<HTMLTextAreaElement>(null);

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
                        <InputBig
                            ref={areaRef}
                            value={input}
                            onChange={(value) => setInput(value.target.value)}
                            placeholder="Задайте вопрос..."
                            className="h-auto! min-h-9 w-full rounded-lg border-0 bg-transparent p-2 text-main-100 placeholder:text-main-400 focus-visible:ring-0"
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    onSubmit();
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

                                <div className="z-20">
                                    <Dropdown
                                        options={attachOptions}
                                        menuPlacement="top"
                                        menuClassName="w-66"
                                        matchTriggerWidth={false}
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
                                    disabled={isGenerating || !input.trim()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSubmit();
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
        </>
    );
};
