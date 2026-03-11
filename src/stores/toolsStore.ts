import { makeAutoObservable } from "mobx";
import type { BuiltinToolPackage, OllamaToolDefinition } from "../types/Chat";

class ToolsStore {
    packages: BuiltinToolPackage[] = [];

    enabledToolNames = new Set<string>();
    requiredPromptToolNames = new Set<string>();
    isLoading = false;
    isLoaded = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
        void this.loadBuiltinToolPackages();
    }

    private normalizePackages(payload: unknown): BuiltinToolPackage[] {
        if (!Array.isArray(payload)) {
            return [];
        }

        return payload
            .map((item) => {
                if (!item || typeof item !== "object") {
                    return null;
                }

                const maybePackage = item as Partial<BuiltinToolPackage>;

                if (
                    typeof maybePackage.id !== "string" ||
                    typeof maybePackage.title !== "string" ||
                    typeof maybePackage.description !== "string" ||
                    !Array.isArray(maybePackage.tools)
                ) {
                    return null;
                }

                const tools = maybePackage.tools.filter(
                    (tool): tool is BuiltinToolPackage["tools"][number] => {
                        if (!tool || typeof tool !== "object") {
                            return false;
                        }

                        const maybeTool =
                            tool as BuiltinToolPackage["tools"][number];

                        return (
                            typeof maybeTool.packageId === "string" &&
                            typeof maybeTool.packageTitle === "string" &&
                            typeof maybeTool.packageDescription === "string" &&
                            maybeTool.schema?.type === "function" &&
                            typeof maybeTool.schema.function?.name === "string"
                        );
                    },
                );

                return {
                    id: maybePackage.id,
                    title: maybePackage.title,
                    description: maybePackage.description,
                    tools: tools.map((tool) => ({
                        ...tool,
                        ...(tool.outputScheme &&
                        typeof tool.outputScheme === "object" &&
                        !Array.isArray(tool.outputScheme)
                            ? { outputScheme: tool.outputScheme }
                            : {}),
                    })),
                };
            })
            .filter((pkg): pkg is BuiltinToolPackage => Boolean(pkg));
    }

    async loadBuiltinToolPackages(): Promise<void> {
        if (this.isLoading) {
            return;
        }

        const api = window.appApi;
        if (!api?.tools?.getBuiltinToolPackages) {
            this.isLoaded = true;
            return;
        }

        this.isLoading = true;

        try {
            const packagesPayload = await api.tools.getBuiltinToolPackages();
            const nextPackages = this.normalizePackages(packagesPayload);
            const nextToolNames = new Set(
                nextPackages.flatMap((pkg) =>
                    pkg.tools.map((tool) => tool.schema.function.name),
                ),
            );

            this.packages = nextPackages;
            this.enabledToolNames = this.enabledToolNames.size
                ? new Set(
                      Array.from(this.enabledToolNames).filter((toolName) =>
                          nextToolNames.has(toolName),
                      ),
                  )
                : nextToolNames;
            this.requiredPromptToolNames = new Set(
                Array.from(this.requiredPromptToolNames).filter((toolName) =>
                    this.enabledToolNames.has(toolName),
                ),
            );
        } catch (error) {
            console.error("Failed to load builtin tool packages", error);
        } finally {
            this.isLoading = false;
            this.isLoaded = true;
        }
    }

    get allTools() {
        return this.packages.flatMap((pkg) => pkg.tools);
    }

    get allToolOptions() {
        return this.allTools.map((tool) => ({
            value: tool.schema.function.name,
            label: tool.schema.function.name,
            description: tool.schema.function.description || "",
        }));
    }

    get enabledToolOptions() {
        const enabledSet = this.enabledToolNames;

        return this.allToolOptions.filter((option) =>
            enabledSet.has(option.value),
        );
    }

    get requiredPromptTools(): string[] {
        return Array.from(this.requiredPromptToolNames).filter((toolName) =>
            this.enabledToolNames.has(toolName),
        );
    }

    get requiredPromptInstruction(): string {
        const selected = this.requiredPromptTools;

        if (!selected.length) {
            return "";
        }

        return [
            "REQUIRED_TOOL_POLICY:",
            `- You must use these tools while completing the task when they are relevant: ${selected.join(", ")}`,
            "- Do not skip a required tool if the final answer depends on information that the tool is intended to provide.",
            "- If a required tool fails, state that clearly and continue with the best justified answer possible.",
        ].join("\n");
    }

    isToolEnabled(toolName: string): boolean {
        return this.enabledToolNames.has(toolName);
    }

    setToolEnabled(toolName: string, enabled: boolean): void {
        const knownTool = this.allTools.some(
            (tool) => tool.schema.function.name === toolName,
        );

        if (!knownTool) {
            return;
        }

        if (enabled) {
            this.enabledToolNames.add(toolName);
            return;
        }

        this.enabledToolNames.delete(toolName);
        this.requiredPromptToolNames.delete(toolName);
    }

    setRequiredPromptTools(toolNames: string[]): void {
        const knownEnabled = new Set(
            this.enabledToolOptions.map((item) => item.value),
        );
        this.requiredPromptToolNames = new Set(
            toolNames.filter((toolName) => knownEnabled.has(toolName)),
        );
    }

    get toolDefinitions(): OllamaToolDefinition[] {
        return this.getToolDefinitions();
    }

    getToolDefinitions(
        excludeToolNames: string[] = [],
    ): OllamaToolDefinition[] {
        const excludedNames = new Set(excludeToolNames);
        const userTools = this.allTools.filter(
            (tool) =>
                this.enabledToolNames.has(tool.schema.function.name) &&
                !excludedNames.has(tool.schema.function.name),
        );

        return userTools.map((tool) => tool.schema);
    }

    getFilteredPackages(query: string): BuiltinToolPackage[] {
        const normalized = query.trim().toLowerCase();

        if (!normalized) {
            return this.packages;
        }

        return this.packages
            .map((pkg) => {
                const packageMatch =
                    pkg.title.toLowerCase().includes(normalized) ||
                    pkg.description.toLowerCase().includes(normalized);

                if (packageMatch) {
                    return pkg;
                }

                const tools = pkg.tools.filter((tool) => {
                    const toolName = tool.schema.function.name.toLowerCase();
                    const toolDescription =
                        tool.schema.function.description?.toLowerCase() || "";

                    return (
                        toolName.includes(normalized) ||
                        toolDescription.includes(normalized)
                    );
                });

                return {
                    ...pkg,
                    tools,
                };
            })
            .filter((pkg) => pkg.tools.length > 0);
    }
}

export const toolsStore = new ToolsStore();
