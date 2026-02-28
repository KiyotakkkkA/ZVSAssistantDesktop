import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScenario } from "./useScenario";
import type {
    ScenarioConditionMeta,
    ScenarioConnection,
    ScenarioPromptMeta,
    ScenarioScene,
    ScenarioSceneViewport,
    ScenarioSimpleBlockNode,
    ScenarioToolMeta,
    ScenarioVariableMeta,
} from "../../types/Scenario";
import { getConnectionSemantic } from "../../utils/scenario/scenarioPorts";
import {
    DEFAULT_VIEWPORT,
    type Point,
    type ScenarioCanvasInsertPayload,
    buildBlockPortAnchors,
    createInsertedBlock,
    createStartEndBlocks,
    hasInputPort,
    hasOutputPort,
    normalizeBlock,
    normalizeConditionMeta,
    normalizeConnection,
    normalizePromptMeta,
    normalizeToolMeta,
    normalizeVariableMeta,
    normalizeViewport,
    toPlainObject,
    toScene,
} from "../../utils/scenario/scenarioCanvasScene";

export type { Point, ScenarioCanvasInsertPayload };

export const useScenarioCanvas = () => {
    const { activeScenario, updateScenario } = useScenario();
    const [blocks, setBlocks] = useState<ScenarioSimpleBlockNode[]>([]);
    const [connections, setConnections] = useState<ScenarioConnection[]>([]);
    const [viewport, setViewport] =
        useState<ScenarioSceneViewport>(DEFAULT_VIEWPORT);
    const [isSaving, setIsSaving] = useState(false);

    const blocksRef = useRef<ScenarioSimpleBlockNode[]>([]);

    const blocksById = useMemo(
        () => new Map(blocks.map((block) => [block.id, block])),
        [blocks],
    );

    useEffect(() => {
        const scene = toScene(activeScenario?.content);

        if (!scene) {
            setBlocks([]);
            setConnections([]);
            setViewport(DEFAULT_VIEWPORT);
            return;
        }

        setBlocks(scene.blocks);
        setConnections(scene.connections);
        setViewport(scene.viewport);
    }, [activeScenario?.content, activeScenario?.id]);

    useEffect(() => {
        blocksRef.current = blocks;
    }, [blocks]);

    const createConnection = useCallback(
        (
            fromBlockId: string,
            toBlockId: string,
            fromPortName?: string,
            toPortName?: string,
        ) => {
            if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) {
                return null;
            }

            let created: ScenarioConnection | null = null;

            setConnections((prev) => {
                const exists = prev.some(
                    (connection) =>
                        connection.fromBlockId === fromBlockId &&
                        connection.toBlockId === toBlockId &&
                        (connection.fromPortName ?? "") ===
                            (fromPortName ?? "") &&
                        (connection.toPortName ?? "") === (toPortName ?? ""),
                );

                if (exists) {
                    return prev;
                }

                created = {
                    id: crypto.randomUUID(),
                    fromBlockId,
                    toBlockId,
                    ...(fromPortName ? { fromPortName } : {}),
                    ...(toPortName ? { toPortName } : {}),
                };

                return [...prev, created as ScenarioConnection];
            });

            return created;
        },
        [],
    );

    const completeConnection = useCallback(
        (
            fromBlockId: string,
            toBlockId: string,
            fromPortName?: string,
            toPortName?: string,
        ) => {
            if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) {
                return false;
            }

            const sourceBlock = blocksRef.current.find(
                (block) => block.id === fromBlockId,
            );
            const targetBlock = blocksRef.current.find(
                (block) => block.id === toBlockId,
            );

            if (!sourceBlock || !targetBlock) {
                return false;
            }

            if (
                !hasOutputPort(sourceBlock.kind) ||
                !hasInputPort(targetBlock.kind)
            ) {
                return false;
            }

            const semantic = getConnectionSemantic(sourceBlock, targetBlock, {
                fromPortName,
                toPortName,
            });

            if (semantic === "invalid") {
                return false;
            }

            createConnection(fromBlockId, toBlockId, fromPortName, toPortName);
            return true;
        },
        [createConnection],
    );

    const deleteConnection = useCallback((connectionId: string) => {
        if (!connectionId) {
            return;
        }

        setConnections((prev) =>
            prev.filter((connection) => connection.id !== connectionId),
        );
    }, []);

    const createInitialScene = useCallback(() => {
        setBlocks(createStartEndBlocks());
        setConnections([]);
    }, []);

    const insertBlock = useCallback(
        (payload: ScenarioCanvasInsertPayload, center: Point) => {
            const inserted = createInsertedBlock(payload, center);
            setBlocks((prev) => [...prev, inserted]);
            return inserted.id;
        },
        [],
    );

    const removeBlock = useCallback(
        (blockId: string) => {
            const block = blocksById.get(blockId);

            if (!block || block.kind === "start" || block.kind === "end") {
                return false;
            }

            setBlocks((prev) => prev.filter((item) => item.id !== blockId));
            setConnections((prev) =>
                prev.filter(
                    (connection) =>
                        connection.fromBlockId !== blockId &&
                        connection.toBlockId !== blockId,
                ),
            );

            return true;
        },
        [blocksById],
    );

    const updateToolMeta = useCallback(
        (blockId: string, meta: ScenarioToolMeta) => {
            const normalizedMeta = normalizeToolMeta(toPlainObject(meta));

            setBlocks((prev) =>
                prev.map((block) =>
                    block.id === blockId && block.kind === "tool"
                        ? (() => {
                              const nextBlock: ScenarioSimpleBlockNode = {
                                  ...block,
                                  meta: {
                                      ...block.meta,
                                      tool: normalizedMeta,
                                  },
                              };

                              return {
                                  ...nextBlock,
                                  portAnchors: buildBlockPortAnchors(nextBlock),
                              };
                          })()
                        : block,
                ),
            );
        },
        [],
    );

    const updatePromptMeta = useCallback(
        (blockId: string, meta: ScenarioPromptMeta) => {
            const normalizedMeta = normalizePromptMeta(toPlainObject(meta));

            setBlocks((prev) =>
                prev.map((block) =>
                    block.id === blockId && block.kind === "prompt"
                        ? {
                              ...block,
                              meta: {
                                  ...block.meta,
                                  prompt: normalizedMeta,
                              },
                          }
                        : block,
                ),
            );
        },
        [],
    );

    const updateConditionMeta = useCallback(
        (blockId: string, meta: ScenarioConditionMeta) => {
            const normalizedMeta = normalizeConditionMeta(toPlainObject(meta));

            setBlocks((prev) =>
                prev.map((block) =>
                    block.id === blockId && block.kind === "condition"
                        ? (() => {
                              const nextBlock: ScenarioSimpleBlockNode = {
                                  ...block,
                                  meta: {
                                      ...block.meta,
                                      condition: normalizedMeta,
                                  },
                              };

                              return {
                                  ...nextBlock,
                                  portAnchors: buildBlockPortAnchors(nextBlock),
                              };
                          })()
                        : block,
                ),
            );
        },
        [],
    );

    const updateVariableMeta = useCallback(
        (blockId: string, meta: ScenarioVariableMeta) => {
            const normalizedMeta = normalizeVariableMeta(toPlainObject(meta));

            setBlocks((prev) =>
                prev.map((block) =>
                    block.id === blockId && block.kind === "variable"
                        ? (() => {
                              const nextBlock: ScenarioSimpleBlockNode = {
                                  ...block,
                                  meta: {
                                      ...block.meta,
                                      variable: normalizedMeta,
                                  },
                              };

                              return {
                                  ...nextBlock,
                                  portAnchors: buildBlockPortAnchors(nextBlock),
                              };
                          })()
                        : block,
                ),
            );
        },
        [],
    );

    const saveScene = useCallback(
        async (nextViewport?: Partial<ScenarioSceneViewport>) => {
            if (!activeScenario) {
                return null;
            }

            const mergedViewport = {
                ...viewport,
                ...(nextViewport || {}),
            };

            setIsSaving(true);

            try {
                const serializableBlocks = blocks.map((block) =>
                    normalizeBlock(block),
                );
                const serializableConnections = connections
                    .map((connection) => normalizeConnection(connection))
                    .filter(
                        (connection): connection is ScenarioConnection =>
                            connection !== null,
                    );
                const serializableViewport = normalizeViewport(mergedViewport);

                return updateScenario(activeScenario.id, {
                    name: activeScenario.name,
                    description: activeScenario.description,
                    content: {
                        scene: {
                            version: 1,
                            blocks: serializableBlocks,
                            connections: serializableConnections,
                            viewport: serializableViewport,
                        } satisfies ScenarioScene,
                    },
                });
            } finally {
                setIsSaving(false);
            }
        },
        [activeScenario, blocks, connections, updateScenario, viewport],
    );

    const hasScene = useMemo(() => blocks.length > 0, [blocks.length]);

    return {
        blocks,
        blocksById,
        setBlocks,
        connections,
        setConnections,
        viewport,
        setViewport,
        hasScene,
        isSaving,
        createInitialScene,
        insertBlock,
        removeBlock,
        createConnection,
        completeConnection,
        deleteConnection,
        updateToolMeta,
        updatePromptMeta,
        updateConditionMeta,
        updateVariableMeta,
        saveScene,
    };
};
