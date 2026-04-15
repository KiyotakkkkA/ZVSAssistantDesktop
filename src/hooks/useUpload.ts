import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import type { ChatImageAttachment } from "../../electron/models/chat";
import {
    buildImageAttachmentFromFile,
    buildImageUploadAcceptValue,
    isSameImageAttachment,
    MAX_IMAGE_UPLOAD_SIZE_BYTES,
} from "../utils/chat/imageUploadStrategies";
import { convertBytesToSize } from "../utils/converters";

const IMAGE_ACCEPT_VALUE = buildImageUploadAcceptValue();

type UseUploadResult = {
    attachments: ChatImageAttachment[];
    accept: string;
    inputRef: RefObject<HTMLInputElement>;
    openPicker: () => void;
    removeAttachment: (attachmentId: string) => void;
    clearAttachments: () => void;
    onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const useUpload = (): UseUploadResult => {
    const toasts = useToasts();
    const inputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<ChatImageAttachment[]>([]);

    const openPicker = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const removeAttachment = useCallback((attachmentId: string) => {
        setAttachments((current) =>
            current.filter((attachment) => attachment.id !== attachmentId),
        );
    }, []);

    const clearAttachments = useCallback(() => {
        setAttachments([]);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }, []);

    const onInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);

            if (files.length === 0) {
                return;
            }

            void (async () => {
                const nextAttachments: ChatImageAttachment[] = [];

                for (const file of files) {
                    try {
                        const nextAttachment =
                            await buildImageAttachmentFromFile(file);
                        nextAttachments.push(nextAttachment);
                    } catch (error) {
                        const reason =
                            error instanceof Error ? error.message : "unknown";

                        if (reason === "file-is-too-large") {
                            toasts.warning({
                                title: "Файл слишком большой",
                                description: `${file.name} превышает лимит ${convertBytesToSize(MAX_IMAGE_UPLOAD_SIZE_BYTES)}.`,
                            });
                            continue;
                        }

                        toasts.warning({
                            title: "Формат не поддерживается",
                            description: `Файл ${file.name} не является поддерживаемым изображением.`,
                        });
                    }
                }

                if (nextAttachments.length === 0) {
                    if (inputRef.current) {
                        inputRef.current.value = "";
                    }

                    return;
                }

                setAttachments((current) => {
                    const deduped = nextAttachments.filter(
                        (candidate) =>
                            !current.some((existing) =>
                                isSameImageAttachment(existing, candidate),
                            ),
                    );

                    if (deduped.length === 0) {
                        return current;
                    }

                    return [...current, ...deduped];
                });

                if (inputRef.current) {
                    inputRef.current.value = "";
                }
            })();
        },
        [toasts],
    );

    return {
        attachments,
        accept: IMAGE_ACCEPT_VALUE,
        inputRef,
        openPicker,
        removeAttachment,
        clearAttachments,
        onInputChange,
    };
};
