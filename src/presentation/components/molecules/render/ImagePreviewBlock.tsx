import {
    useEffect,
    useRef,
    useState,
    type PointerEventHandler,
    type WheelEventHandler,
} from "react";
import { Icon } from "@iconify/react";
import { Button } from "../../atoms";
import { useToasts } from "../../../../hooks";

interface ImagePreviewBlockProps {
    src: string;
    title?: string;
    nonLocalSrc?: boolean;
    downloadFileName?: string;
}

const buildDownloadName = (preferred?: string) => {
    if (preferred?.trim()) {
        return preferred.trim();
    }

    return `image_${crypto.randomUUID().replace(/-/g, "")}.svg`;
};

const toLocalPath = (value: string) => {
    if (/^file:\/\//i.test(value)) {
        try {
            const decoded = decodeURIComponent(
                value.replace(/^file:\/\//i, ""),
            );
            return decoded.replace(/^\/+([A-Za-z]:)/, "$1");
        } catch {
            return value;
        }
    }

    return value;
};

export function ImagePreviewBlock({
    src,
    title = "Image Preview",
    nonLocalSrc = false,
    downloadFileName,
}: ImagePreviewBlockProps) {
    const toasts = useToasts();
    const [isExpanded, setIsExpanded] = useState(false);
    const [scale, setScale] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isZooming, setIsZooming] = useState(false);
    const wheelStopTimerRef = useRef<number | null>(null);
    const dragState = useRef({
        active: false,
        startX: 0,
        startY: 0,
    });

    const resetView = () => {
        setScale(1);
        setOffsetX(0);
        setOffsetY(0);
    };

    const handleDownload = async () => {
        try {
            const result = await window.appApi?.files.saveImageFromSource({
                src,
                preferredFileName: buildDownloadName(downloadFileName),
            });

            if (!result) {
                return;
            }

            toasts.success({
                title: "Изображение сохранено",
                description: result.savedPath,
            });
        } catch {
            toasts.danger({
                title: "Ошибка скачивания",
                description: "Не удалось скачать изображение.",
            });
        }
    };

    const handleOpenPreview = async () => {
        if (nonLocalSrc) {
            const openedByApi = await window.appApi?.files.openExternalUrl(src);

            if (openedByApi) {
                return;
            }

            window.open(src, "_blank", "noopener,noreferrer");
            return;
        }

        const opened = await window.appApi?.files.openPath(toLocalPath(src));

        if (opened) {
            return;
        }

        window.open(src, "_blank", "noopener,noreferrer");
    };

    const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
        if (event.button !== 0) {
            return;
        }

        dragState.current = {
            active: true,
            startX: event.clientX,
            startY: event.clientY,
        };
        setIsDragging(true);

        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
        if (!dragState.current.active) {
            return;
        }

        const deltaX = event.clientX - dragState.current.startX;
        const deltaY = event.clientY - dragState.current.startY;

        dragState.current.startX = event.clientX;
        dragState.current.startY = event.clientY;

        setOffsetX((value) => value + deltaX);
        setOffsetY((value) => value + deltaY);
    };

    const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
        dragState.current.active = false;
        setIsDragging(false);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const onWheel: WheelEventHandler<HTMLDivElement> = (event) => {
        event.preventDefault();
        event.stopPropagation();

        setIsZooming(true);

        if (wheelStopTimerRef.current !== null) {
            window.clearTimeout(wheelStopTimerRef.current);
        }

        wheelStopTimerRef.current = window.setTimeout(() => {
            setIsZooming(false);
            wheelStopTimerRef.current = null;
        }, 140);

        setScale((current) => {
            const next = event.deltaY < 0 ? current * 1.08 : current / 1.08;
            return Math.min(2.6, Math.max(0.35, next));
        });
    };

    useEffect(() => {
        return () => {
            if (wheelStopTimerRef.current !== null) {
                window.clearTimeout(wheelStopTimerRef.current);
            }
        };
    }, []);

    return (
        <>
            <div className="mb-2 overflow-hidden rounded-xl border border-main-400/20 bg-main-900/80 last:mb-0">
                <div className="flex items-center justify-between border-b border-main-400/20 bg-main-800/70 p-2">
                    <span className="text-[11px] uppercase tracking-wide text-main-300">
                        {title} • {Math.round(scale * 100)}%
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="secondary"
                            label="Download image"
                            shape="rounded-lg"
                            className="p-1 text-xs gap-1"
                            onClick={() => {
                                void handleDownload();
                            }}
                        >
                            <Icon icon="mdi:download" width="14" height="14" />
                            Скачать
                        </Button>
                        <Button
                            variant="secondary"
                            label="View image"
                            shape="rounded-lg"
                            className="p-1 text-xs gap-1"
                            onClick={() => {
                                void handleOpenPreview();
                            }}
                        >
                            <Icon
                                icon="mdi:open-in-new"
                                width="14"
                                height="14"
                            />
                            Перейти
                        </Button>
                        <Button
                            variant="secondary"
                            label="Expand image"
                            shape="rounded-lg"
                            className="p-1 text-xs gap-1"
                            onClick={() => {
                                setIsExpanded((prev) => !prev);
                                resetView();
                            }}
                        >
                            <Icon
                                icon={
                                    isExpanded
                                        ? "mdi:fullscreen-exit"
                                        : "mdi:fullscreen"
                                }
                                width="14"
                                height="14"
                            />
                            {isExpanded ? "Свернуть" : "Развернуть"}
                        </Button>
                    </div>
                </div>

                <div
                    className={`${isExpanded ? "h-[80vh]" : "h-112"} relative overflow-hidden bg-main-950/70 p-2`}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onWheel={onWheel}
                    style={{
                        cursor: isDragging ? "grabbing" : "grab",
                    }}
                >
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                            transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`,
                            transformOrigin: "center center",
                            willChange:
                                isDragging || isZooming ? "transform" : "auto",
                        }}
                    >
                        <img
                            src={src}
                            alt="Tool image preview"
                            className="max-h-full max-w-full rounded-lg border border-main-700/70 bg-main-100"
                            draggable={false}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
