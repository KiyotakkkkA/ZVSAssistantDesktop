export type ToolTraceStatus = "accepted" | "cancelled" | "failed";

export type ToolExecutionError = {
    toolName: string;
    code: string;
    message: string;
    statusCode?: number;
    details?: unknown;
};

export type ToolExecutionFailure = {
    ok: false;
    error: ToolExecutionError;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return value !== null && typeof value === "object";
};

const tryParseJsonRecord = (value: string): Record<string, unknown> | null => {
    try {
        const parsed = JSON.parse(value) as unknown;
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const toToolErrorPayload = (
    toolName: string,
    error: unknown,
): ToolExecutionFailure => {
    const fallbackMessage = `Ошибка выполнения инструмента ${toolName}`;
    let message = fallbackMessage;
    let statusCode: number | undefined;
    let details: unknown;

    if (error instanceof Error) {
        message = error.message || fallbackMessage;

        if ("status" in error && typeof error.status === "number") {
            statusCode = error.status;
        }

        if ("payload" in error) {
            details = error.payload;
        }
    } else if (isRecord(error)) {
        if (typeof error.message === "string" && error.message.trim()) {
            message = error.message;
        }

        if (typeof error.statusCode === "number") {
            statusCode = error.statusCode;
        }

        details = error;
    } else if (typeof error === "string" && error.trim()) {
        message = error;
    }

    const structuredMessage = tryParseJsonRecord(message);

    if (structuredMessage) {
        if (typeof structuredMessage.message === "string") {
            message = structuredMessage.message;
        } else if (typeof structuredMessage.error === "string") {
            message = structuredMessage.error;
        }

        if (
            statusCode === undefined &&
            typeof structuredMessage.statusCode === "number"
        ) {
            statusCode = structuredMessage.statusCode;
        }

        details = details ?? structuredMessage;
    }

    const code =
        statusCode === 401
            ? "unauthorized"
            : statusCode === 403
              ? "forbidden"
              : statusCode === 404
                ? "not_found"
                : "tool_execution_failed";

    return {
        ok: false,
        error: {
            toolName,
            code,
            message,
            ...(statusCode !== undefined ? { statusCode } : {}),
            ...(details !== undefined ? { details } : {}),
        },
    };
};

export const isToolExecutionFailure = (
    result: unknown,
): result is ToolExecutionFailure => {
    if (!isRecord(result) || result.ok !== false || !isRecord(result.error)) {
        return false;
    }

    return typeof result.error.message === "string";
};

export const inferToolTraceStatus = (
    _toolName: string,
    result: unknown,
): ToolTraceStatus => {
    if (
        isRecord(result) &&
        (result.status === "cancelled" || result.status === "interrupted")
    ) {
        return "cancelled";
    }

    return isToolExecutionFailure(result) ? "failed" : "accepted";
};
