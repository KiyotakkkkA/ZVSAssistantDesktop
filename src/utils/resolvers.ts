export const resolveText = (value: unknown) => {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Error) {
        return value.message;
    }

    if (value == null) {
        return "";
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export const resolveFileExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf(".");

    if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
        return "file";
    }

    return fileName.slice(dotIndex + 1).toLowerCase();
};
