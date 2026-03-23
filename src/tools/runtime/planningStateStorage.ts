import type {
    PlanningStep,
    PlanningToolResult,
    PlanningToolState,
} from "../../../electron/models/tool";

const createProgressText = (completed: number, total: number) => {
    if (total <= 0) {
        return "0/0";
    }

    return `${completed}/${total}`;
};

const toPlanningResult = (state: PlanningToolState): PlanningToolResult => {
    const completedSteps: PlanningToolResult["completed_steps"] = [];
    const pendingSteps: PlanningToolResult["pending_steps"] = [];

    for (const step of state.steps) {
        const item = { id: step.id, description: step.description };

        if (step.isDone) {
            completedSteps.push(item);
            continue;
        }

        pendingSteps.push(item);
    }

    const nextStep = pendingSteps[0] ?? null;

    return {
        plan_id: state.plan_id,
        title: state.title,
        progress: createProgressText(completedSteps.length, state.steps.length),
        is_complete: pendingSteps.length === 0 && state.steps.length > 0,
        next_step: nextStep,
        pending_steps: pendingSteps,
        completed_steps: completedSteps,
    };
};

const normalizeStepDescriptions = (steps: string[]): PlanningStep[] => {
    return steps
        .map((step) => step.trim())
        .filter((step) => step.length > 0)
        .map((description, index) => ({
            id: index + 1,
            description,
            isDone: false,
        }));
};

export class PlanningStateStorage {
    private readonly plansByDialogId = new Map<string, PlanningToolState>();

    createSteps(dialogId: string, title: string, steps: string[]) {
        const normalizedSteps = normalizeStepDescriptions(steps);

        const planState: PlanningToolState = {
            plan_id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: title.trim() || "План выполнения",
            steps: normalizedSteps,
        };

        this.plansByDialogId.set(dialogId, planState);

        return toPlanningResult(planState);
    }

    markStep(dialogId: string, stepId: number) {
        const planState = this.plansByDialogId.get(dialogId);

        if (!planState) {
            return null;
        }

        const step = planState.steps.find((item) => item.id === stepId);

        if (step) {
            step.isDone = true;
        }

        return toPlanningResult(planState);
    }

    getNextStep(dialogId: string) {
        const planState = this.plansByDialogId.get(dialogId);

        if (!planState) {
            return null;
        }

        return toPlanningResult(planState);
    }
}
