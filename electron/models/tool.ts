export type ToolTraceStatus = "pending" | "running" | "done" | "error";

export type ToolTrace = {
    callId: string;
    toolName: string;
    status: ToolTraceStatus;
    args?: unknown;
    result?: unknown;
    error?: string;
    createdAt: string;
    updatedAt: string;
};

export type AskToolQuestion = {
    id: string;
    question: string;
    reason?: string;
    selectAnswers?: string[];
    userAnswerHint?: string;
    answer?: string;
};

export type AskToolResult = {
    questions: AskToolQuestion[];
    activeQuestionIndex: number;
    answered?: boolean;
};

export type PlanningStep = {
    id: number;
    description: string;
    isDone: boolean;
};

export type PlanningToolState = {
    plan_id: string;
    title: string;
    steps: PlanningStep[];
};

export type PlanningToolResult = {
    plan_id: string;
    title: string;
    progress: string;
    is_complete: boolean;
    next_step: { id: number; description: string } | null;
    pending_steps: Array<{ id: number; description: string }>;
    completed_steps: Array<{ id: number; description: string }>;
};
