import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Button,
    Dropdown,
    InputBig,
    InputCheckbox,
    InputSmall,
} from "../../atoms";
import { ShikiCodeBlock } from "../../molecules/render/ShikiCodeBlock";
import type {
    ScenarioBlockToolsParamsUsage,
    ScenarioSimpleBlockNode,
    ScenarioToolMeta,
} from "../../../../types/Scenario";

type ToolSchemaProperty = {
    description?: string;
    default?: unknown;
};

type ToolSchemaField = {
    param: string;
    description: string;
    schemaDefaultValue?: string;
};

const EMPTY_AVAILABLE_VARIABLES: Array<{ key: string; label: string }> = [];

const stringifySchemaValue = (value: unknown): string => {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const parseToolSchemaFields = (schema: string): ToolSchemaField[] => {
    try {
        const parsed = JSON.parse(schema) as {
            properties?: Record<string, ToolSchemaProperty>;
        };

        if (!parsed.properties || typeof parsed.properties !== "object") {
            return [];
        }

        return Object.entries(parsed.properties).map(([param, property]) => {
            const hasDefault =
                property &&
                typeof property === "object" &&
                "default" in property;

            return {
                param,
                description:
                    typeof property?.description === "string"
                        ? property.description
                        : "",
                ...(hasDefault
                    ? {
                          schemaDefaultValue: stringifySchemaValue(
                              property.default,
                          ),
                      }
                    : {}),
            };
        });
    } catch {
        return [];
    }
};

interface ScenarioBlockSettingsFormProps {
    block: ScenarioSimpleBlockNode;
    connectedInputNames?: Set<string>;
    availableVariables?: Array<{
        key: string;
        label: string;
    }>;
    onSave: (blockId: string, input: ScenarioBlockToolsParamsUsage[]) => void;
    onClose: () => void;
}

export function ScenarioBlockSettingsForm({
    block,
    connectedInputNames,
    availableVariables = EMPTY_AVAILABLE_VARIABLES,
    onSave,
    onClose,
}: ScenarioBlockSettingsFormProps) {
    const meta = (block.meta?.tool as ScenarioToolMeta | undefined) ?? {
        toolName: block.title,
        toolSchema: "{}",
        input: [],
    };

    const [toolInput, setToolInput] = useState<ScenarioBlockToolsParamsUsage[]>(
        [],
    );

    const schemaFields = useMemo(
        () => parseToolSchemaFields(meta.toolSchema || "{}"),
        [meta.toolSchema],
    );

    const schemaDefaultsByParam = useMemo(
        () =>
            new Map(
                schemaFields.map((field) => [
                    field.param,
                    field.schemaDefaultValue,
                ]),
            ),
        [schemaFields],
    );

    useEffect(() => {
        const normalizedInput = Array.isArray(meta.input) ? meta.input : [];

        if (schemaFields.length > 0) {
            const byParam = new Map(
                normalizedInput.map((item) => [item.param, item]),
            );

            setToolInput(
                schemaFields.map((field) => {
                    const existing = byParam.get(field.param);
                    const defaultValue =
                        existing?.defaultValue ?? field.schemaDefaultValue;

                    return {
                        param: field.param,
                        description: field.description,
                        comment: existing?.comment || "",
                        ...(defaultValue !== undefined ? { defaultValue } : {}),
                    };
                }),
            );
            return;
        }

        setToolInput(normalizedInput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.id]);

    const updateToolInput = useCallback(
        (
            param: string,
            updater: (
                prev: ScenarioBlockToolsParamsUsage,
            ) => ScenarioBlockToolsParamsUsage,
        ) => {
            setToolInput((prev) =>
                prev.map((item) =>
                    item.param === param ? updater(item) : item,
                ),
            );
        },
        [],
    );

    const insertVariableToken = useCallback(
        (param: string, variableKey: string) => {
            const token = `{${variableKey}}`;

            updateToolInput(param, (prev) => {
                const current = prev.defaultValue ?? "";

                if (current.includes(token)) {
                    return prev;
                }

                const suffix = current ? `${current}${token}` : token;

                return {
                    ...prev,
                    defaultValue: suffix,
                };
            });
        },
        [updateToolInput],
    );

    const handleSave = () => {
        onSave(block.id, toolInput);
        onClose();
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <p className="text-sm text-main-300">Схема параметров</p>
                <ShikiCodeBlock
                    code={meta.toolSchema || "{}"}
                    language="json"
                />
            </div>

            <div className="space-y-1">
                <p className="text-sm text-main-300">Ввод</p>

                {toolInput.length === 0 ? (
                    <p className="rounded-xl border border-main-700/70 bg-main-900/50 px-3 py-2 text-xs text-main-400">
                        В schema не найдено properties для настройки.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {toolInput.map((item) => {
                            const hasDefault = item.defaultValue !== undefined;
                            const schemaDefaultValue =
                                schemaDefaultsByParam.get(item.param);
                            const isConnected =
                                connectedInputNames?.has(item.param) ?? false;

                            return (
                                <div
                                    key={item.param}
                                    className="space-y-2 rounded-xl border border-main-700/70 bg-main-900/50 p-3"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-main-100">
                                            {item.param}
                                        </p>
                                        {item.description ? (
                                            <p className="text-xs text-main-400">
                                                {item.description}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs text-main-300">
                                            Комментарий
                                        </p>
                                        {isConnected ? (
                                            <div className="rounded-lg border border-main-700/70 bg-main-800/60 px-3 py-2 text-xs font-semibold text-main-200">
                                                СВЯЗАНО
                                            </div>
                                        ) : (
                                            <InputBig
                                                value={item.comment}
                                                onChange={(value) => {
                                                    updateToolInput(
                                                        item.param,
                                                        (prev) => ({
                                                            ...prev,
                                                            comment: value,
                                                        }),
                                                    );
                                                }}
                                                placeholder="Комментарий к параметру"
                                                className="h-20 rounded-lg border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs text-main-300">
                                                Значение по умолчанию
                                            </p>
                                            <InputCheckbox
                                                checked={hasDefault}
                                                disabled={isConnected}
                                                onChange={(checked) => {
                                                    if (!checked) {
                                                        updateToolInput(
                                                            item.param,
                                                            (prev) => ({
                                                                param: prev.param,
                                                                description:
                                                                    prev.description,
                                                                comment:
                                                                    prev.comment,
                                                            }),
                                                        );
                                                        return;
                                                    }

                                                    updateToolInput(
                                                        item.param,
                                                        (prev) => ({
                                                            ...prev,
                                                            defaultValue:
                                                                prev.defaultValue ??
                                                                schemaDefaultValue ??
                                                                "",
                                                        }),
                                                    );
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <Dropdown
                                                options={availableVariables.map(
                                                    (variable) => ({
                                                        value: variable.key,
                                                        label: variable.label,
                                                        onClick: () =>
                                                            insertVariableToken(
                                                                item.param,
                                                                variable.key,
                                                            ),
                                                    }),
                                                )}
                                                disabled={
                                                    isConnected ||
                                                    availableVariables.length ===
                                                        0
                                                }
                                                menuPlacement="top"
                                                closeOnSelect
                                                matchTriggerWidth={false}
                                                menuClassName="w-64"
                                                renderTrigger={({
                                                    toggleOpen,
                                                    triggerRef,
                                                    disabled,
                                                    ariaProps,
                                                }) => (
                                                    <Button
                                                        variant="secondary"
                                                        ref={triggerRef}
                                                        className="h-8 rounded-lg px-3 text-xs"
                                                        disabled={disabled}
                                                        onClick={toggleOpen}
                                                        {...ariaProps}
                                                    >
                                                        Использовать переменную
                                                    </Button>
                                                )}
                                            />
                                        </div>

                                        {hasDefault ? (
                                            <InputSmall
                                                value={item.defaultValue || ""}
                                                disabled={isConnected}
                                                onChange={(event) => {
                                                    updateToolInput(
                                                        item.param,
                                                        (prev) => ({
                                                            ...prev,
                                                            defaultValue:
                                                                event.target
                                                                    .value,
                                                        }),
                                                    );
                                                }}
                                                placeholder="Введите значение"
                                                className="mt-2"
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-1">
                <Button
                    variant="primary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    onClick={handleSave}
                >
                    Сохранить
                </Button>
            </div>
        </div>
    );
}
