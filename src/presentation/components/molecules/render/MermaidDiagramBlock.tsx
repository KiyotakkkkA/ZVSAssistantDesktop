import { useEffect, useId, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "../../atoms";
import { ImagePreviewBlock } from "./ImagePreviewBlock";
import { ShikiCodeBlock } from "./ShikiCodeBlock";

type MermaidModule = {
    initialize: (config: {
        startOnLoad: boolean;
        securityLevel: "strict";
        theme: "dark" | "base";
        themeVariables?: Record<string, string | number | boolean>;
        suppressErrorRendering: boolean;
    }) => void;
    parse: (definition: string) => Promise<unknown> | unknown;
    render: (
        id: string,
        definition: string,
    ) => Promise<{ svg: string }> | { svg: string };
};

let mermaidModulePromise: Promise<MermaidModule> | null = null;
let isMermaidInitialized = false;

const getMermaid = async () => {
    if (!mermaidModulePromise) {
        mermaidModulePromise = import("mermaid").then((module) => {
            return module.default as MermaidModule;
        });
    }

    const mermaid = await mermaidModulePromise;

    if (!isMermaidInitialized) {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables: {
                darkMode: true,
                background: "#0b1220",
                textColor: "#e2e8f0",
                lineColor: "#94a3b8",
                primaryColor: "#111827",
                primaryTextColor: "#e2e8f0",
                primaryBorderColor: "#334155",
                secondaryColor: "#0f172a",
                secondaryTextColor: "#e2e8f0",
                secondaryBorderColor: "#334155",
                tertiaryColor: "#1f2937",
                tertiaryTextColor: "#e2e8f0",
                tertiaryBorderColor: "#334155",
                actorBkg: "#111827",
                actorTextColor: "#e2e8f0",
                actorBorder: "#334155",
                signalColor: "#cbd5e1",
                signalTextColor: "#e2e8f0",
                labelBoxBkgColor: "#111827",
                labelTextColor: "#e2e8f0",
                noteBkgColor: "#0f172a",
                noteTextColor: "#e2e8f0",
                noteBorderColor: "#334155",
                activationBkgColor: "#1e293b",
                activationBorderColor: "#475569",
            },
            suppressErrorRendering: true,
        });
        isMermaidInitialized = true;
    }

    return mermaid;
};

const toBase64 = (input: string) => {
    const bytes = new TextEncoder().encode(input);
    const chunkSize = 0x8000;
    let binary = "";

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
};

const forceDarkSvgBackground = (svg: string) => {
    return svg.replace(/<svg\b([^>]*)>/i, (fullMatch, attributes: string) => {
        if (/\sstyle\s*=\s*"[^"]*"/i.test(attributes)) {
            return `<svg${attributes.replace(
                /\sstyle\s*=\s*"([^"]*)"/i,
                (_styleMatch, styleValue: string) =>
                    ` style="${styleValue};background-color:#0b1220;border-radius:12px;"`,
            )}>`;
        }

        return `<svg${attributes} style="background-color:#0b1220;border-radius:12px;">`;
    });
};

interface MermaidDiagramBlockProps {
    code: string;
}

export function MermaidDiagramBlock({ code }: MermaidDiagramBlockProps) {
    const [previewSrc, setPreviewSrc] = useState("");
    const [viewMode, setViewMode] = useState<"image" | "code">("image");
    const [isRendering, setIsRendering] = useState(true);
    const [renderError, setRenderError] = useState<string | null>(null);

    const baseId = useId();
    const diagramId = useMemo(
        () => `zvs-mermaid-${baseId.replace(/[^a-z0-9_-]/gi, "")}`,
        [baseId],
    );

    useEffect(() => {
        let isCancelled = false;

        const renderMermaid = async () => {
            setIsRendering(true);
            setRenderError(null);
            setPreviewSrc("");

            try {
                const mermaid = await getMermaid();
                await mermaid.parse(code);
                const rendered = await mermaid.render(
                    `${diagramId}-${Date.now()}`,
                    code,
                );

                if (!isCancelled) {
                    const svgWithDarkBg = forceDarkSvgBackground(rendered.svg);
                    const src = `data:image/svg+xml;base64,${toBase64(svgWithDarkBg)}`;
                    setPreviewSrc(src);
                }
            } catch (error) {
                if (!isCancelled) {
                    const errorText =
                        error instanceof Error
                            ? error.message
                            : "Не удалось построить Mermaid-диаграмму.";

                    setRenderError(errorText);
                    setViewMode("code");
                }
            } finally {
                if (!isCancelled) {
                    setIsRendering(false);
                }
            }
        };

        void renderMermaid();

        return () => {
            isCancelled = true;
        };
    }, [code, diagramId]);

    return (
        <div className="last:mb-0">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-main-400/20 bg-main-900/80 p-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-main-300">
                    <Icon icon="mdi:graph-outline" width="14" height="14" />
                    Mermaid
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="secondary"
                        label="Show diagram"
                        shape="rounded-lg"
                        className={`p-1 text-xs gap-1 ${viewMode === "image" ? "border-main-300/40 bg-main-700/70" : ""}`}
                        onClick={() => setViewMode("image")}
                    >
                        <Icon icon="mdi:image-outline" width="14" height="14" />
                        Изображение
                    </Button>
                    <Button
                        variant="secondary"
                        label="Show source"
                        shape="rounded-lg"
                        className={`p-1 text-xs gap-1 ${viewMode === "code" ? "border-main-300/40 bg-main-700/70" : ""}`}
                        onClick={() => setViewMode("code")}
                    >
                        <Icon icon="mdi:code-tags" width="14" height="14" />
                        Код
                    </Button>
                </div>
            </div>

            {viewMode === "code" && (
                <ShikiCodeBlock code={code} language="mermaid" />
            )}

            {viewMode === "image" && isRendering && (
                <div className="mb-2 overflow-hidden rounded-xl border border-main-400/20 bg-main-900/80 p-3 last:mb-0">
                    <div className="h-60 w-full animate-pulse rounded-lg bg-main-800/70" />
                </div>
            )}

            {viewMode === "image" && !isRendering && previewSrc && (
                <ImagePreviewBlock
                    src={previewSrc}
                    title="Mermaid diagram"
                    nonLocalSrc={false}
                    downloadFileName="mermaid-diagram.svg"
                />
            )}

            {renderError && (
                <p className="mb-2 text-xs text-red-300/90 last:mb-0">
                    Ошибка рендера Mermaid: {renderError}
                </p>
            )}
        </div>
    );
}
