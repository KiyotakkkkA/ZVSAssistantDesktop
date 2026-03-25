import { type ToolSet } from "ai";
import { PlanningStateStorage } from "../../src/tools/runtime/planningStateStorage";
import { buildToolSetFromPacks } from "../../src/tools/runtime/contracts";
import { builtInToolPacks } from "../../src/tools";

interface BuildToolsInput {
    dialogId?: string;
    packIds?: string[];
    enabledToolNames?: string[];
}

const normalizeToolNames = (value?: string[]) => {
    if (!Array.isArray(value)) {
        return undefined;
    }

    return [...new Set(value.filter((item) => typeof item === "string"))];
};

export class ToolsRuntimeService {
    private readonly planningStateStorage = new PlanningStateStorage();

    buildToolSet({
        dialogId,
        packIds,
        enabledToolNames,
    }: BuildToolsInput): ToolSet {
        const resolvedPackIds =
            packIds && packIds.length > 0 ? packIds : ["systemTools"];
        const allowedToolNames = normalizeToolNames(enabledToolNames);

        const packs = builtInToolPacks
            .filter((pack) => resolvedPackIds.includes(pack.id))
            .map((pack) => {
                if (!allowedToolNames) {
                    return pack;
                }

                return {
                    ...pack,
                    tools: pack.tools.filter((tool) =>
                        allowedToolNames.includes(tool.name),
                    ),
                };
            });

        return buildToolSetFromPacks(packs, {
            dialogId: dialogId ?? "default-dialog",
            planningStateStorage: this.planningStateStorage,
        });
    }
}
