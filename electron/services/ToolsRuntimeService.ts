import { type ToolSet } from "ai";
import { PlanningStateStorage } from "../../src/tools/runtime/planningStateStorage";
import { buildToolSetFromPacks } from "../../src/tools/runtime/contracts";
import { builtInToolPacks } from "../../src/tools";
import type { AllowedWebToolsProviders } from "../models/user";

interface BuildToolsInput {
    dialogId?: string;
    packIds?: string[];
    enabledToolNames?: string[];
    webToolsProvider?: AllowedWebToolsProviders;
    providerBaseUrl?: string;
    providerApiKey?: string;
}

export class ToolsRuntimeService {
    private readonly planningStateStorage = new PlanningStateStorage();

    buildToolSet({
        dialogId,
        packIds,
        enabledToolNames,
        webToolsProvider,
        providerBaseUrl,
        providerApiKey,
    }: BuildToolsInput): ToolSet {
        const resolvedPackIds =
            packIds && packIds.length > 0 ? packIds : ["systemTools"];

        const packs = builtInToolPacks
            .filter((pack) => resolvedPackIds.includes(pack.id))
            .map((pack) => {
                if (!enabledToolNames) {
                    return pack;
                }

                return {
                    ...pack,
                    tools: pack.tools.filter((tool) =>
                        enabledToolNames.includes(tool.name),
                    ),
                };
            });

        return buildToolSetFromPacks(packs, {
            dialogId: dialogId ?? "default-dialog",
            planningStateStorage: this.planningStateStorage,
            webToolsProvider,
            providerBaseUrl,
            providerApiKey,
        });
    }
}
