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
