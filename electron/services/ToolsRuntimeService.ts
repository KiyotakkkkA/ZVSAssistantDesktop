import { type ToolSet } from "ai";
import { PlanningStateStorage } from "../../src/tools/runtime/planningStateStorage";
import { buildToolSetFromPacks } from "../../src/tools/runtime/contracts";
import { builtInToolPacks } from "../../src/tools";

interface BuildToolsInput {
    dialogId?: string;
    packIds?: string[];
}

export class ToolsRuntimeService {
    private readonly planningStateStorage = new PlanningStateStorage();

    buildToolSet({ dialogId, packIds }: BuildToolsInput): ToolSet {
        const resolvedPackIds =
            packIds && packIds.length > 0 ? packIds : ["systemTools"];

        const packs = builtInToolPacks.filter((pack) =>
            resolvedPackIds.includes(pack.id),
        );

        return buildToolSetFromPacks(packs, {
            dialogId: dialogId ?? "default-dialog",
            planningStateStorage: this.planningStateStorage,
        });
    }
}
