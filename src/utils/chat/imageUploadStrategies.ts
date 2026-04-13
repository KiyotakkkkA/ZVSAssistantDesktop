import type { ChatImageAttachment } from "../../../electron/models/chat";

export type ImageUploadStrategy = {
    extensions: readonly string[];
    mimeTypes: readonly string[];
    normalizedMimeType: string;
};

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024;

const IMAGE_UPLOAD_STRATEGIES: readonly ImageUploadStrategy[] = [
    {
        extensions: ["jpg", "jpeg"],
        mimeTypes: ["image/jpeg"],
        normalizedMimeType: "image/jpeg",
    },
    {
        extensions: ["png"],
        mimeTypes: ["image/png"],
        normalizedMimeType: "image/png",
    },
    {
        extensions: ["webp"],
        mimeTypes: ["image/webp"],
        normalizedMimeType: "image/webp",
    },
    {
        extensions: ["gif"],
        mimeTypes: ["image/gif"],
        normalizedMimeType: "image/gif",
    },
    {
        extensions: ["bmp"],
        mimeTypes: ["image/bmp"],
        normalizedMimeType: "image/bmp",
    },
    {
        extensions: ["avif"],
        mimeTypes: ["image/avif"],
        normalizedMimeType: "image/avif",
    },
] as const;

export const buildImageUploadAcceptValue = () => {
    const extensions = IMAGE_UPLOAD_STRATEGIES.flatMap((strategy) =>
        strategy.extensions.map((extension) => `.${extension}`),
    );

    return extensions.join(",");
};

const getFileExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");

    if (dotIndex < 0 || dotIndex === fileName.length - 1) {
        return "";
    }

    return fileName.slice(dotIndex + 1).toLowerCase();
};

export const resolveImageUploadStrategy = (file: File) => {
    const extension = getFileExtension(file.name);
    const normalizedMimeType = file.type.toLowerCase();

    const byMimeType = IMAGE_UPLOAD_STRATEGIES.find((strategy) =>
        strategy.mimeTypes.includes(normalizedMimeType),
    );

    if (byMimeType) {
        return {
            extension,
            mimeType: byMimeType.normalizedMimeType,
        };
    }

    const byExtension = IMAGE_UPLOAD_STRATEGIES.find((strategy) =>
        strategy.extensions.includes(extension),
    );

    if (byExtension) {
        return {
            extension,
            mimeType: byExtension.normalizedMimeType,
        };
    }

    return null;
};

const readFileAsDataUrl = async (file: File) => {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const nextResult = reader.result;

            if (typeof nextResult === "string") {
                resolve(nextResult);
                return;
            }

            reject(new Error("Не удалось прочитать изображение."));
        };

        reader.onerror = () => {
            reject(
                reader.error ?? new Error("Не удалось прочитать изображение."),
            );
        };

        reader.readAsDataURL(file);
    });
};

const createAttachmentId = (): ChatImageAttachment["id"] =>
    `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const buildImageAttachmentFromFile = async (
    file: File,
): Promise<ChatImageAttachment> => {
    const resolvedStrategy = resolveImageUploadStrategy(file);

    if (!resolvedStrategy) {
        throw new Error("unsupported-extension");
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
        throw new Error("file-is-too-large");
    }

    const dataUrl = await readFileAsDataUrl(file);

    return {
        id: createAttachmentId(),
        fileName: file.name,
        extension: resolvedStrategy.extension,
        mimeType: resolvedStrategy.mimeType,
        size: file.size,
        dataUrl,
    };
};

export const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isSameImageAttachment = (
    left: ChatImageAttachment,
    right: ChatImageAttachment,
) => {
    return (
        left.fileName === right.fileName &&
        left.size === right.size &&
        left.mimeType === right.mimeType
    );
};
