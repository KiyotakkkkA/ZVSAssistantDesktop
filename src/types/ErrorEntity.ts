export type ErrorEntityKind = "business" | "technical";

export type ErrorEntity = {
    kind: ErrorEntityKind;
    code: string;
    message: string;
    context?: string;
    details?: unknown;
    cause?: string;
    timestamp: string;
};
