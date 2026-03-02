import { randomUUID } from "node:crypto";
import type {
    CreateScenarioPayload,
    Scenario,
    ScenarioListItem,
    UpdateScenarioPayload,
} from "../../../src/types/Scenario";
import { DatabaseService } from "../storage/DatabaseService";

export class ScenariosService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly createdBy: string,
    ) {}

    getScenariosList(): ScenarioListItem[] {
        return this.readScenarios().map((scenario) =>
            this.toScenarioListItem(scenario),
        );
    }

    getScenarioById(scenarioId: string): Scenario | null {
        const scenarios = this.readScenarios();
        return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
    }

    createScenario(payload: CreateScenarioPayload): Scenario {
        const now = new Date().toISOString();
        const scenario: Scenario = {
            id: this.normalizeScenarioId(undefined),
            name: payload.name.trim() || "Новый сценарий",
            description: payload.description.trim(),
            content: this.normalizeContent(payload.content),
            cachedModelScenarioHash: "",
            cachedModelScenario: "",
            createdAt: now,
            updatedAt: now,
        };

        this.writeScenario(scenario);
        return scenario;
    }

    updateScenario(
        scenarioId: string,
        payload: UpdateScenarioPayload,
    ): Scenario | null {
        const current = this.getScenarioById(scenarioId);

        if (!current) {
            return null;
        }

        const next: Scenario = {
            ...current,
            name: payload.name.trim() || current.name,
            description: payload.description.trim(),
            content: this.normalizeContent(payload.content ?? current.content),
            cachedModelScenarioHash:
                typeof payload.cachedModelScenarioHash === "string"
                    ? payload.cachedModelScenarioHash
                    : (current.cachedModelScenarioHash ?? ""),
            cachedModelScenario:
                typeof payload.cachedModelScenario === "string"
                    ? payload.cachedModelScenario
                    : (current.cachedModelScenario ?? ""),
            updatedAt: new Date().toISOString(),
        };

        this.writeScenario(next);
        return next;
    }

    deleteScenario(scenarioId: string): Scenario | null {
        const scenario = this.getScenarioById(scenarioId);

        if (!scenario) {
            return null;
        }

        this.databaseService.deleteScenario(scenario.id, this.createdBy);
        return scenario;
    }

    private readScenarios(): Scenario[] {
        const scenarios: Scenario[] = [];

        for (const rawItem of this.databaseService.getScenariosRaw(
            this.createdBy,
        )) {
            const parsed = rawItem as Partial<Scenario>;
            const now = new Date().toISOString();

            if (
                typeof parsed.name !== "string" ||
                typeof parsed.description !== "string"
            ) {
                continue;
            }

            scenarios.push({
                id: this.normalizeScenarioId(parsed.id),
                name: parsed.name.trim() || "Новый сценарий",
                description: parsed.description,
                content: this.normalizeContent(parsed.content),
                cachedModelScenarioHash:
                    typeof parsed.cachedModelScenarioHash === "string"
                        ? parsed.cachedModelScenarioHash
                        : "",
                cachedModelScenario:
                    typeof parsed.cachedModelScenario === "string"
                        ? parsed.cachedModelScenario
                        : "",
                createdAt:
                    typeof parsed.createdAt === "string" && parsed.createdAt
                        ? parsed.createdAt
                        : now,
                updatedAt:
                    typeof parsed.updatedAt === "string" && parsed.updatedAt
                        ? parsed.updatedAt
                        : now,
            });
        }

        scenarios.sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
        );

        return scenarios;
    }

    private writeScenario(scenario: Scenario): void {
        this.databaseService.upsertScenarioRaw(
            scenario.id,
            scenario,
            this.createdBy,
        );
    }

    private normalizeScenarioId(id: unknown): string {
        if (typeof id === "string" && id.startsWith("scenario_")) {
            return id;
        }

        return `scenario_${randomUUID().replace(/-/g, "")}`;
    }

    private normalizeContent(content: unknown): Record<string, unknown> {
        if (content && typeof content === "object" && !Array.isArray(content)) {
            return content as Record<string, unknown>;
        }

        return {};
    }

    private toScenarioListItem(scenario: Scenario): ScenarioListItem {
        return {
            id: scenario.id,
            title: scenario.name,
            preview: scenario.description.trim() || "Сценарий без описания",
            time: new Date(scenario.updatedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            updatedAt: scenario.updatedAt,
        };
    }
}
