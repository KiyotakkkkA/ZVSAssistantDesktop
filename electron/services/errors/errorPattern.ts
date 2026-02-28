import type { ErrorEntity } from "../../../src/types/ErrorEntity";

export class ServiceError extends Error {
    constructor(public readonly entity: ErrorEntity) {
        super(entity.message);
        this.name = "ServiceError";
    }
}

const unknownToMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return typeof error === "string" ? error : "Unknown error";
};

export const createBusinessErrorEntity = (
    code: string,
    message: string,
    details?: unknown,
): ErrorEntity => ({
    kind: "business",
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    timestamp: new Date().toISOString(),
});

export const createTechnicalExceptionEntity = (
    code: string,
    context: string,
    error: unknown,
    details?: unknown,
): ErrorEntity => ({
    kind: "technical",
    code,
    message: unknownToMessage(error),
    context,
    ...(details !== undefined ? { details } : {}),
    cause: error instanceof Error ? error.name : undefined,
    timestamp: new Date().toISOString(),
});

export const raiseBusinessError = (
    code: string,
    message: string,
    details?: unknown,
): never => {
    throw new ServiceError(createBusinessErrorEntity(code, message, details));
};

export const toErrorEntity = (
    error: unknown,
    context = "service",
): ErrorEntity => {
    if (error instanceof ServiceError) {
        return error.entity;
    }

    if (error instanceof Error) {
        return createTechnicalExceptionEntity(
            "TECHNICAL_FAILURE",
            context,
            error,
        );
    }

    return createTechnicalExceptionEntity("TECHNICAL_FAILURE", context, error);
};

export const throwTechnicalException = (
    context: string,
    error: unknown,
    code = "TECHNICAL_FAILURE",
    details?: unknown,
): never => {
    throw new ServiceError(
        createTechnicalExceptionEntity(code, context, error, details),
    );
};

export const runWithServiceBoundary = async <T>(
    context: string,
    action: () => Promise<T>,
): Promise<T> => {
    try {
        return await action();
    } catch (error) {
        if (error instanceof ServiceError) {
            throw error;
        }

        throwTechnicalException(context, error);
    }

    throw new Error("Unreachable service boundary state");
};

export const runWithServiceBoundarySync = <T>(
    context: string,
    action: () => T,
): T => {
    try {
        return action();
    } catch (error) {
        if (error instanceof ServiceError) {
            throw error;
        }

        throwTechnicalException(context, error);
    }

    throw new Error("Unreachable service boundary state");
};

export const attempt = async <T>(
    action: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> => {
    try {
        return { ok: true, value: await action() };
    } catch (error) {
        return { ok: false, error };
    }
};

export const attemptSync = <T>(
    action: () => T,
): { ok: true; value: T } | { ok: false; error: unknown } => {
    try {
        return { ok: true, value: action() };
    } catch (error) {
        return { ok: false, error };
    }
};

export const attemptOrNull = async <T>(
    action: () => Promise<T>,
): Promise<T | null> => {
    const result = await attempt(action);
    return result.ok ? result.value : null;
};

export const attemptOr = async <T>(
    action: () => Promise<T>,
    fallback: T,
): Promise<T> => {
    const result = await attempt(action);
    return result.ok ? result.value : fallback;
};

export const attemptSyncOr = <T>(action: () => T, fallback: T): T => {
    const result = attemptSync(action);
    return result.ok ? result.value : fallback;
};

export const attemptSyncOrNull = <T>(action: () => T): T | null => {
    const result = attemptSync(action);
    return result.ok ? result.value : null;
};
