import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button, Dropdown, InputBig, Modal } from "../../atoms";
import { useToasts } from "../../../../hooks";
import { useScenarioCanvas } from "../../../../hooks/agents";
import type { ScenarioCanvasInsertPayload } from "../../../../hooks/agents";
import type {
    ScenarioConditionMeta,
    ScenarioConnection,
    ScenarioSceneViewport,
    ScenarioSimpleBlockNode,
    ScenarioVariableKey,
    ScenarioVariableMeta,
} from "../../../../types/Scenario";
import { ScenarioBlockSettingsForm } from "../forms/ScenarioBlockSettingsForm";
import { ScenarioConditionSettingsForm } from "../forms/ScenarioConditionSettingsForm";
import { ScenarioVariableSettingsForm } from "../forms/ScenarioVariableSettingsForm";
import { ScenarioCanvasToolbar } from "./support/ScenarioCanvasToolbar";
import { ScenarioConnectionsLayer } from "./support/ScenarioConnectionsLayer";
import { ScenarioSimpleBlock } from "./blocks/ScenarioSimpleBlock";
import { ScenarioToolBlock } from "./blocks/ScenarioToolBlock";
import { ScenarioPromptBlock } from "./blocks/ScenarioPromptBlock";
import { ScenarioConditionBlock } from "./blocks/ScenarioConditionBlock";
import { ScenarioVariableBlock } from "./blocks/ScenarioVariableBlock";
import { getScenarioVariableTitle } from "../../../../utils/scenario/scenarioVariables";
import {
    buildConnectionPath,
    clamp,
    createDefaultConditionMeta,
    createDefaultVariableMeta,
    getInPoint,
    getInputPoint,
    getOutPoint,
    toScenePoint,
    type Point,
} from "../../../../utils/scenario/scenarioCanvasFuncs";

type DragState = {
    blockId: string;
    startClient: Point;
    origin: Point;
};

type ConnectionMenuState = {
    connectionId: string;
    x: number;
    y: number;
    token: number;
};

type BlockMenuState = {
    blockId: string;
    x: number;
    y: number;
    token: number;
};

type PendingConnectionState = {
    blockId: string;
    fromPortName?: string;
};

export type ScenarioCanvasInsertRequest = {
    token: number;
} & ScenarioCanvasInsertPayload;

type ScenarioCanvasProps = {
    insertRequest?: ScenarioCanvasInsertRequest | null;
    onInsertHandled?: () => void;
};

const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 2000;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const DEFAULT_SCALE = 1;
const DEFAULT_OFFSET = { x: 80, y: 80 };
const EMPTY_CONNECTED_INPUTS = new Set<string>();

export function ScenarioCanvas({
    insertRequest,
    onInsertHandled,
}: ScenarioCanvasProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const panStartRef = useRef<Point | null>(null);
    const panOriginRef = useRef<Point | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const pendingBlockPositionsRef = useRef<Record<string, Point> | null>(null);
    const blocksByIdRef = useRef<Map<string, ScenarioSimpleBlockNode>>(
        new Map(),
    );
    const pendingConnectionFromRef = useRef<PendingConnectionState | null>(
        null,
    );
    const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
    const blockMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

    const toasts = useToasts();
    const {
        blocks,
        blocksById,
        setBlocks,
        connections,
        viewport,
        setViewport,
        hasScene,
        isSaving,
        createInitialScene,
        insertBlock,
        removeBlock,
        completeConnection,
        deleteConnection,
        updateToolMeta,
        updatePromptMeta,
        updateConditionMeta,
        updateVariableMeta,
        saveScene,
    } = useScenarioCanvas();

    const [isPanning, setIsPanning] = useState(false);
    const [pendingConnectionFrom, setPendingConnectionFrom] =
        useState<PendingConnectionState | null>(null);
    const [pointerScenePoint, setPointerScenePoint] = useState<Point | null>(
        null,
    );
    const [connectionMenu, setConnectionMenu] =
        useState<ConnectionMenuState | null>(null);
    const [blockMenu, setBlockMenu] = useState<BlockMenuState | null>(null);

    const [showGrid, setShowGrid] = useState(viewport.showGrid ?? true);
    const [scale, setScale] = useState(viewport.scale ?? DEFAULT_SCALE);
    const [offset, setOffset] = useState<Point>({
        x: viewport.offsetX ?? DEFAULT_OFFSET.x,
        y: viewport.offsetY ?? DEFAULT_OFFSET.y,
    });

    const [settingsBlockId, setSettingsBlockId] = useState<string | null>(null);
    const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

    const [promptInstruction, setPromptInstruction] = useState("");
    const [conditionMeta, setConditionMeta] = useState<ScenarioConditionMeta>(
        createDefaultConditionMeta,
    );
    const [variableMeta, setVariableMeta] = useState<ScenarioVariableMeta>(
        createDefaultVariableMeta,
    );

    useEffect(() => {
        blocksByIdRef.current = blocksById;
    }, [blocksById]);

    useEffect(() => {
        pendingConnectionFromRef.current = pendingConnectionFrom;
        if (!pendingConnectionFrom) {
            setPointerScenePoint(null);
        }
    }, [pendingConnectionFrom]);

    useEffect(() => {
        setShowGrid(viewport.showGrid ?? true);
        setScale(viewport.scale ?? DEFAULT_SCALE);
        setOffset({
            x: viewport.offsetX ?? DEFAULT_OFFSET.x,
            y: viewport.offsetY ?? DEFAULT_OFFSET.y,
        });
    }, [viewport.offsetX, viewport.offsetY, viewport.scale, viewport.showGrid]);

    const activeSettingsBlock = settingsBlockId
        ? (blocksById.get(settingsBlockId) ?? null)
        : null;
    const availableScenarioVariables = useMemo(() => {
        const selected = blocks
            .filter((block) => block.kind === "variable")
            .flatMap((block) => block.meta?.variable?.selectedVariables ?? []);

        const uniq = Array.from(
            new Set<ScenarioVariableKey>(selected as ScenarioVariableKey[]),
        );

        return uniq.map((key) => ({
            key,
            label: getScenarioVariableTitle(key),
        }));
    }, [blocks]);

    const isToolModalOpen = activeSettingsBlock?.kind === "tool";
    const isPromptModalOpen = activeSettingsBlock?.kind === "prompt";
    const isConditionModalOpen = activeSettingsBlock?.kind === "condition";
    const isVariableModalOpen = activeSettingsBlock?.kind === "variable";

    useEffect(() => {
        if (!activeSettingsBlock) {
            return;
        }

        if (activeSettingsBlock.kind === "prompt") {
            setPromptInstruction(
                activeSettingsBlock.meta?.prompt?.instruction ?? "",
            );
            return;
        }

        if (activeSettingsBlock.kind === "condition") {
            setConditionMeta(
                activeSettingsBlock.meta?.condition ??
                    createDefaultConditionMeta(),
            );
            return;
        }

        if (activeSettingsBlock.kind === "variable") {
            setVariableMeta(
                activeSettingsBlock.meta?.variable ??
                    createDefaultVariableMeta(),
            );
        }
    }, [activeSettingsBlock]);

    useEffect(() => {
        if (!insertRequest || !viewportRef.current) {
            return;
        }

        const rect = viewportRef.current.getBoundingClientRect();
        const centerX = (rect.width / 2 - offset.x) / scale - 140;
        const centerY = (rect.height / 2 - offset.y) / scale - 48;

        insertBlock(insertRequest, {
            x: centerX,
            y: centerY,
        });
        onInsertHandled?.();
    }, [
        insertBlock,
        insertRequest,
        offset.x,
        offset.y,
        onInsertHandled,
        scale,
    ]);

    const zoomPercent = Math.round(scale * 100);

    const gridStyle = useMemo(() => {
        if (!showGrid) {
            return {};
        }

        return {
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1px)`,
            backgroundSize: `${32 * scale}px ${32 * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
        };
    }, [showGrid, scale, offset.x, offset.y]);

    const applyViewport = useCallback(
        (partial: Partial<ScenarioSceneViewport>) => {
            setViewport((prev) => ({
                ...prev,
                canvasWidth: CANVAS_WIDTH,
                canvasHeight: CANVAS_HEIGHT,
                scale,
                offsetX: offset.x,
                offsetY: offset.y,
                showGrid,
                ...partial,
            }));
        },
        [offset.x, offset.y, scale, setViewport, showGrid],
    );

    const scheduleBlocksCommit = useCallback(() => {
        if (rafRef.current !== null) {
            return;
        }

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;

            const pending = pendingBlockPositionsRef.current;

            if (!pending) {
                return;
            }

            setBlocks((prev) =>
                prev.map((block) => {
                    const next = pending[block.id];

                    if (!next) {
                        return block;
                    }

                    return {
                        ...block,
                        x: next.x,
                        y: next.y,
                    };
                }),
            );
        });
    }, [setBlocks]);

    const beginPan = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.button !== 0 || dragStateRef.current) {
                return;
            }

            setConnectionMenu(null);
            setBlockMenu(null);
            setIsPanning(true);
            panStartRef.current = { x: event.clientX, y: event.clientY };
            panOriginRef.current = offset;
        },
        [offset],
    );

    const openBlockContextMenu = useCallback(
        (event: React.MouseEvent<HTMLDivElement>, blockId: string) => {
            event.preventDefault();
            event.stopPropagation();

            const block = blocksByIdRef.current.get(blockId);
            const rect = viewportRef.current?.getBoundingClientRect();

            if (!block || !rect) {
                return;
            }

            if (block.kind === "start" || block.kind === "end") {
                return;
            }

            setConnectionMenu(null);
            setBlockMenu({
                blockId,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                token: Date.now(),
            });
        },
        [],
    );

    const beginDragBlock = useCallback(
        (event: React.PointerEvent<HTMLDivElement>, blockId: string) => {
            event.stopPropagation();

            const block = blocksByIdRef.current.get(blockId);

            if (!block) {
                return;
            }

            dragStateRef.current = {
                blockId,
                startClient: { x: event.clientX, y: event.clientY },
                origin: { x: block.x, y: block.y },
            };

            setConnectionMenu(null);
        },
        [],
    );

    const onMouseMove = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const viewportRect = viewportRef.current?.getBoundingClientRect();

            if (viewportRect && pendingConnectionFromRef.current) {
                const scenePoint = toScenePoint(
                    event.clientX,
                    event.clientY,
                    viewportRect,
                    offset,
                    scale,
                );
                setPointerScenePoint(scenePoint);
            }

            if (dragStateRef.current && viewportRect) {
                const dragState = dragStateRef.current;
                const deltaX =
                    (event.clientX - dragState.startClient.x) / scale;
                const deltaY =
                    (event.clientY - dragState.startClient.y) / scale;

                pendingBlockPositionsRef.current = {
                    ...(pendingBlockPositionsRef.current || {}),
                    [dragState.blockId]: {
                        x: dragState.origin.x + deltaX,
                        y: dragState.origin.y + deltaY,
                    },
                };

                scheduleBlocksCommit();
                return;
            }

            if (!isPanning || !panStartRef.current || !panOriginRef.current) {
                return;
            }

            const deltaX = event.clientX - panStartRef.current.x;
            const deltaY = event.clientY - panStartRef.current.y;

            setOffset({
                x: panOriginRef.current.x + deltaX,
                y: panOriginRef.current.y + deltaY,
            });
        },
        [isPanning, offset, scale, scheduleBlocksCommit],
    );

    const endPointerInteractions = useCallback(() => {
        if (dragStateRef.current) {
            dragStateRef.current = null;
            pendingBlockPositionsRef.current = null;
        }

        if (isPanning) {
            setIsPanning(false);
            panStartRef.current = null;
            panOriginRef.current = null;
        }
    }, [isPanning]);

    const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();

        const viewportEl = viewportRef.current;

        if (!viewportEl) {
            return;
        }

        const rect = viewportEl.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const zoomIntensity = event.deltaY > 0 ? -0.1 : 0.1;

        setScale((prevScale) => {
            const nextScale = clamp(
                prevScale + zoomIntensity,
                MIN_SCALE,
                MAX_SCALE,
            );

            if (nextScale === prevScale) {
                return prevScale;
            }

            setOffset((prevOffset) => ({
                x:
                    pointerX -
                    ((pointerX - prevOffset.x) / prevScale) * nextScale,
                y:
                    pointerY -
                    ((pointerY - prevOffset.y) / prevScale) * nextScale,
            }));

            return nextScale;
        });
    };

    const handleCreateInitialScene = useCallback(() => {
        createInitialScene();
        setConnectionMenu(null);
        setPendingConnectionFrom(null);
    }, [createInitialScene]);

    const resetView = useCallback(() => {
        setScale(DEFAULT_SCALE);
        setOffset(DEFAULT_OFFSET);
    }, []);

    const handleStartConnection = useCallback(
        (blockId: string, fromPortName?: string) => {
            const block = blocksByIdRef.current.get(blockId);

            if (!block || block.kind === "end") {
                return;
            }

            setConnectionMenu(null);
            setPendingConnectionFrom((prev) =>
                prev?.blockId === blockId &&
                (prev.fromPortName ?? "") === (fromPortName ?? "")
                    ? null
                    : {
                          blockId,
                          ...(fromPortName ? { fromPortName } : {}),
                      },
            );
        },
        [],
    );

    const handleCompleteConnection = useCallback(
        (blockId: string, toPortName?: string) => {
            const pendingConnection = pendingConnectionFromRef.current;

            if (!pendingConnection) {
                return;
            }

            const connected = completeConnection(
                pendingConnection.blockId,
                blockId,
                pendingConnection.fromPortName,
                toPortName,
            );

            if (!connected) {
                toasts.warning({
                    title: "Соединение отклонено",
                    description:
                        "Проверьте направление связи и совместимость типов входа/выхода.",
                });
                return;
            }

            setPendingConnectionFrom(null);
        },
        [completeConnection, toasts],
    );

    const handleConnectionClick = (
        event: React.MouseEvent<SVGPathElement>,
        connection: ScenarioConnection,
    ) => {
        event.stopPropagation();

        const rect = viewportRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        setConnectionMenu({
            connectionId: connection.id,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            token: Date.now(),
        });
    };

    const requestDeleteBlock = useCallback((blockId: string) => {
        const block = blocksByIdRef.current.get(blockId);

        if (!block || block.kind === "start" || block.kind === "end") {
            return;
        }

        setBlockMenu(null);
        setDeleteBlockId(blockId);
    }, []);

    const confirmDeleteBlock = () => {
        if (!deleteBlockId) {
            return;
        }

        removeBlock(deleteBlockId);

        if (settingsBlockId === deleteBlockId) {
            setSettingsBlockId(null);
        }

        if (pendingConnectionFrom?.blockId === deleteBlockId) {
            setPendingConnectionFrom(null);
        }

        setDeleteBlockId(null);
    };

    const handleSaveScene = useCallback(async () => {
        try {
            const saved = await saveScene({
                scale,
                offsetX: offset.x,
                offsetY: offset.y,
                showGrid,
                canvasWidth: CANVAS_WIDTH,
                canvasHeight: CANVAS_HEIGHT,
            });

            if (saved) {
                toasts.success({
                    title: "Сцена сохранена",
                    description:
                        "Позиции блоков, соединения и мета блоков сохранены.",
                });
                return;
            }

            toasts.warning({
                title: "Не удалось сохранить",
                description: "Сценарий не активен или был удалён.",
            });
        } catch (error) {
            toasts.danger({
                title: "Ошибка сохранения",
                description:
                    error instanceof Error
                        ? error.message
                        : "Не удалось сохранить сцену.",
            });
        }
    }, [offset.x, offset.y, saveScene, scale, showGrid, toasts]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s"
            ) {
                event.preventDefault();
                void handleSaveScene();
            }
        };

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [handleSaveScene]);

    useEffect(() => {
        applyViewport({
            scale,
            offsetX: offset.x,
            offsetY: offset.y,
            showGrid,
            canvasWidth: CANVAS_WIDTH,
            canvasHeight: CANVAS_HEIGHT,
        });
    }, [applyViewport, offset.x, offset.y, scale, showGrid]);

    useEffect(() => {
        if (!connectionMenu?.token) {
            return;
        }

        const timer = window.setTimeout(() => {
            dropdownTriggerRef.current?.click();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [connectionMenu?.token]);

    useEffect(() => {
        if (!blockMenu?.token) {
            return;
        }

        const timer = window.setTimeout(() => {
            blockMenuTriggerRef.current?.click();
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [blockMenu?.token]);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const temporaryConnectionPath = useMemo(() => {
        if (!pendingConnectionFrom || !pointerScenePoint) {
            return null;
        }

        const sourceBlock = blocksById.get(pendingConnectionFrom.blockId);

        if (!sourceBlock) {
            return null;
        }

        return buildConnectionPath(
            getOutPoint(sourceBlock, pendingConnectionFrom.fromPortName),
            pointerScenePoint,
        );
    }, [blocksById, pendingConnectionFrom, pointerScenePoint]);

    const connectedInputNamesByBlock = useMemo(() => {
        const map = new Map<string, Set<string>>();

        connections.forEach((connection) => {
            if (!connection.toPortName) {
                return;
            }

            const bucket = map.get(connection.toBlockId) ?? new Set<string>();
            bucket.add(connection.toPortName);
            map.set(connection.toBlockId, bucket);
        });

        return map;
    }, [connections]);

    const savePromptSettings = () => {
        if (!activeSettingsBlock || activeSettingsBlock.kind !== "prompt") {
            return;
        }

        updatePromptMeta(activeSettingsBlock.id, {
            instruction: promptInstruction,
        });
        setSettingsBlockId(null);
    };

    const saveConditionSettings = () => {
        if (!activeSettingsBlock || activeSettingsBlock.kind !== "condition") {
            return;
        }

        updateConditionMeta(activeSettingsBlock.id, conditionMeta);
        setSettingsBlockId(null);
    };

    const saveVariableSettings = () => {
        if (!activeSettingsBlock || activeSettingsBlock.kind !== "variable") {
            return;
        }

        updateVariableMeta(activeSettingsBlock.id, variableMeta);
        setSettingsBlockId(null);
    };

    return (
        <>
            <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-main-700/70 bg-main-900/50">
                <ScenarioCanvasToolbar
                    hasScene={hasScene}
                    showGrid={showGrid}
                    zoomPercent={zoomPercent}
                    isSaving={isSaving}
                    onGenerate={handleCreateInitialScene}
                    onToggleGrid={() => setShowGrid((prev) => !prev)}
                    onResetView={resetView}
                    onSave={() => {
                        void handleSaveScene();
                    }}
                />

                <div
                    ref={viewportRef}
                    role="presentation"
                    className={`relative h-full w-full overflow-hidden ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
                    onMouseDown={(event) => {
                        setConnectionMenu(null);
                        beginPan(event);
                    }}
                    onMouseMove={onMouseMove}
                    onMouseUp={endPointerInteractions}
                    onMouseLeave={endPointerInteractions}
                    onWheel={onWheel}
                    style={gridStyle}
                >
                    <div
                        className="absolute left-0 top-0"
                        style={{
                            width: CANVAS_WIDTH,
                            height: CANVAS_HEIGHT,
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            transformOrigin: "top left",
                        }}
                    >
                        <ScenarioConnectionsLayer
                            canvasWidth={CANVAS_WIDTH}
                            canvasHeight={CANVAS_HEIGHT}
                            connections={connections}
                            blocksById={blocksById}
                            temporaryConnectionPath={temporaryConnectionPath}
                            buildConnectionPath={buildConnectionPath}
                            getOutPoint={getOutPoint}
                            getInPoint={getInPoint}
                            getInputPoint={getInputPoint}
                            onConnectionMouseDown={handleConnectionClick}
                        />

                        {blocks.map((block) => {
                            if (block.kind === "tool") {
                                return (
                                    <ScenarioToolBlock
                                        key={block.id}
                                        block={block}
                                        isConnectSource={
                                            pendingConnectionFrom?.blockId ===
                                            block.id
                                        }
                                        connectedInputNames={
                                            connectedInputNamesByBlock.get(
                                                block.id,
                                            ) ?? EMPTY_CONNECTED_INPUTS
                                        }
                                        onPointerDown={beginDragBlock}
                                        onStartConnection={
                                            handleStartConnection
                                        }
                                        onCompleteConnection={
                                            handleCompleteConnection
                                        }
                                        onOpenSettings={setSettingsBlockId}
                                        onRequestDelete={requestDeleteBlock}
                                        onContextMenu={openBlockContextMenu}
                                    />
                                );
                            }

                            if (block.kind === "prompt") {
                                return (
                                    <ScenarioPromptBlock
                                        key={block.id}
                                        block={block}
                                        isConnectSource={
                                            pendingConnectionFrom?.blockId ===
                                            block.id
                                        }
                                        onPointerDown={beginDragBlock}
                                        onStartConnection={
                                            handleStartConnection
                                        }
                                        onCompleteConnection={
                                            handleCompleteConnection
                                        }
                                        onContextMenu={openBlockContextMenu}
                                        onOpenSettings={setSettingsBlockId}
                                        onRequestDelete={requestDeleteBlock}
                                    />
                                );
                            }

                            if (block.kind === "condition") {
                                return (
                                    <ScenarioConditionBlock
                                        key={block.id}
                                        block={block}
                                        isConnectSource={
                                            pendingConnectionFrom?.blockId ===
                                            block.id
                                        }
                                        connectedInputNames={
                                            connectedInputNamesByBlock.get(
                                                block.id,
                                            ) ?? EMPTY_CONNECTED_INPUTS
                                        }
                                        onPointerDown={beginDragBlock}
                                        onStartConnection={
                                            handleStartConnection
                                        }
                                        onCompleteConnection={
                                            handleCompleteConnection
                                        }
                                        onContextMenu={openBlockContextMenu}
                                        onOpenSettings={setSettingsBlockId}
                                        onRequestDelete={requestDeleteBlock}
                                    />
                                );
                            }

                            if (block.kind === "variable") {
                                return (
                                    <ScenarioVariableBlock
                                        key={block.id}
                                        block={block}
                                        isConnectSource={
                                            pendingConnectionFrom?.blockId ===
                                            block.id
                                        }
                                        onPointerDown={beginDragBlock}
                                        onStartConnection={
                                            handleStartConnection
                                        }
                                        onCompleteConnection={
                                            handleCompleteConnection
                                        }
                                        onContextMenu={openBlockContextMenu}
                                        onOpenSettings={setSettingsBlockId}
                                        onRequestDelete={requestDeleteBlock}
                                    />
                                );
                            }

                            return (
                                <ScenarioSimpleBlock
                                    key={block.id}
                                    block={block}
                                    isConnectSource={
                                        pendingConnectionFrom?.blockId ===
                                        block.id
                                    }
                                    onPointerDown={beginDragBlock}
                                    onStartConnection={handleStartConnection}
                                    onCompleteConnection={
                                        handleCompleteConnection
                                    }
                                />
                            );
                        })}
                    </div>

                    {connectionMenu ? (
                        <div
                            role="presentation"
                            className="absolute z-30"
                            style={{
                                left: connectionMenu.x,
                                top: connectionMenu.y,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <Dropdown
                                key={connectionMenu.token}
                                options={[
                                    {
                                        value: "delete",
                                        label: "Удалить соединение",
                                        icon: (
                                            <Icon
                                                icon="mdi:trash-can-outline"
                                                width={16}
                                                height={16}
                                            />
                                        ),
                                        onClick: () => {
                                            deleteConnection(
                                                connectionMenu.connectionId,
                                            );
                                            setConnectionMenu(null);
                                        },
                                    },
                                ]}
                                menuPlacement="bottom"
                                closeOnSelect
                                matchTriggerWidth={false}
                                renderTrigger={({
                                    toggleOpen,
                                    triggerRef,
                                    ariaProps,
                                }) => (
                                    <Button
                                        variant=""
                                        className="h-7 w-7 rounded-lg border border-main-700/70 bg-main-900/95 text-main-200 hover:bg-main-700/80"
                                        ref={(element) => {
                                            if (
                                                typeof triggerRef === "function"
                                            ) {
                                                triggerRef(element);
                                            } else if (
                                                triggerRef &&
                                                "current" in triggerRef
                                            ) {
                                                (
                                                    triggerRef as {
                                                        current: HTMLButtonElement | null;
                                                    }
                                                ).current = element;
                                            }

                                            dropdownTriggerRef.current =
                                                element;
                                        }}
                                        onClick={toggleOpen}
                                        {...ariaProps}
                                    >
                                        <Icon
                                            icon="mdi:dots-vertical"
                                            width={16}
                                            height={16}
                                        />
                                    </Button>
                                )}
                            />
                        </div>
                    ) : null}

                    {blockMenu ? (
                        <div
                            role="presentation"
                            className="absolute z-30"
                            style={{
                                left: blockMenu.x,
                                top: blockMenu.y,
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <Dropdown
                                key={blockMenu.token}
                                options={[
                                    {
                                        value: "settings",
                                        label: "Настройки",
                                        icon: (
                                            <Icon
                                                icon="mdi:cog-outline"
                                                width={16}
                                                height={16}
                                            />
                                        ),
                                        onClick: () => {
                                            setSettingsBlockId(
                                                blockMenu.blockId,
                                            );
                                            setBlockMenu(null);
                                        },
                                    },
                                    {
                                        value: "delete",
                                        label: "Удалить",
                                        icon: (
                                            <Icon
                                                icon="mdi:trash-can-outline"
                                                width={16}
                                                height={16}
                                            />
                                        ),
                                        onClick: () => {
                                            requestDeleteBlock(
                                                blockMenu.blockId,
                                            );
                                        },
                                    },
                                ]}
                                menuPlacement="bottom"
                                closeOnSelect
                                matchTriggerWidth={false}
                                renderTrigger={({
                                    toggleOpen,
                                    triggerRef,
                                    ariaProps,
                                }) => (
                                    <Button
                                        variant=""
                                        className="h-7 w-7 rounded-lg border border-main-700/70 bg-main-900/95 text-main-200 hover:bg-main-700/80"
                                        ref={(element) => {
                                            if (
                                                typeof triggerRef === "function"
                                            ) {
                                                triggerRef(element);
                                            } else if (
                                                triggerRef &&
                                                "current" in triggerRef
                                            ) {
                                                (
                                                    triggerRef as {
                                                        current: HTMLButtonElement | null;
                                                    }
                                                ).current = element;
                                            }

                                            blockMenuTriggerRef.current =
                                                element;
                                        }}
                                        onClick={toggleOpen}
                                        {...ariaProps}
                                    >
                                        <Icon
                                            icon="mdi:dots-vertical"
                                            width={16}
                                            height={16}
                                        />
                                    </Button>
                                )}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            <Modal
                open={Boolean(deleteBlockId)}
                onClose={() => setDeleteBlockId(null)}
                title="Удалить блок"
                className="max-w-md"
                footer={
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setDeleteBlockId(null)}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={confirmDeleteBlock}
                        >
                            Удалить
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-main-300">
                    Блок будет удалён вместе со всеми входящими и исходящими
                    соединениями.
                </p>
            </Modal>

            <Modal
                open={Boolean(isToolModalOpen && activeSettingsBlock)}
                onClose={() => setSettingsBlockId(null)}
                title="Настройка блока"
                className="max-w-3xl"
            >
                {activeSettingsBlock && isToolModalOpen ? (
                    <ScenarioBlockSettingsForm
                        block={activeSettingsBlock}
                        connectedInputNames={
                            connectedInputNamesByBlock.get(
                                activeSettingsBlock.id,
                            ) ?? EMPTY_CONNECTED_INPUTS
                        }
                        availableVariables={availableScenarioVariables}
                        onSave={(blockId, input) => {
                            updateToolMeta(blockId, {
                                toolName:
                                    activeSettingsBlock.meta?.tool?.toolName ||
                                    activeSettingsBlock.title,
                                toolSchema:
                                    activeSettingsBlock.meta?.tool
                                        ?.toolSchema || "{}",
                                input,
                                ...(activeSettingsBlock.meta?.tool?.outputScheme
                                    ? {
                                          outputScheme:
                                              activeSettingsBlock.meta?.tool
                                                  ?.outputScheme,
                                      }
                                    : {}),
                            });
                        }}
                        onClose={() => setSettingsBlockId(null)}
                    />
                ) : null}
            </Modal>

            <Modal
                open={Boolean(isPromptModalOpen && activeSettingsBlock)}
                onClose={() => setSettingsBlockId(null)}
                title="Инструкция"
                className="max-w-2xl"
                footer={
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={savePromptSettings}
                    >
                        Сохранить
                    </Button>
                }
            >
                <div className="space-y-2">
                    <p className="text-sm text-main-300">
                        Инструкция для модели
                    </p>
                    <InputBig
                        value={promptInstruction}
                        onChange={setPromptInstruction}
                        placeholder="Опишите, что должна сделать модель на этом шаге"
                        className="h-28 rounded-lg border border-main-700 bg-main-800 px-3 py-2 text-sm text-main-100"
                    />
                </div>
            </Modal>

            <Modal
                closeOnOverlayClick={false}
                open={Boolean(isConditionModalOpen && activeSettingsBlock)}
                onClose={() => setSettingsBlockId(null)}
                title="Условие"
                className="max-w-6xl"
                footer={
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={saveConditionSettings}
                    >
                        Сохранить
                    </Button>
                }
            >
                <div className="max-h-[68vh] overflow-y-auto pr-1">
                    <ScenarioConditionSettingsForm
                        value={conditionMeta}
                        onChange={setConditionMeta}
                    />
                </div>
            </Modal>

            <Modal
                open={Boolean(isVariableModalOpen && activeSettingsBlock)}
                onClose={() => setSettingsBlockId(null)}
                title="Переменные"
                className="max-w-2xl"
                footer={
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        onClick={saveVariableSettings}
                    >
                        Сохранить
                    </Button>
                }
            >
                <ScenarioVariableSettingsForm
                    value={variableMeta}
                    onChange={setVariableMeta}
                />
            </Modal>
        </>
    );
}
