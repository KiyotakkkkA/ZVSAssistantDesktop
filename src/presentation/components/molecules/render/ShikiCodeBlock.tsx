import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { createHighlighter } from "shiki";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../../../../data/MsgToasts";

interface ShikiCodeBlockProps {
    code: string;
    language?: string;
}

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;
const highlightedHtmlCache = new Map<string, string>();

const getHighlighter = () => {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ["dark-plus"],
            langs: [
                "plaintext",
                "bash",
                "shell",
                "javascript",
                "typescript",
                "jsx",
                "tsx",
                "json",
                "python",
                "markdown",
                "yaml",
                "html",
                "css",
                "csharp",
                "sql",
                "xml",
                "lua",
                "go",
                "cpp",
                "rust",
                "php",
                "ruby",
                "kotlin",
                "powershell",
                "mermaid",
            ],
        });
    }

    return highlighterPromise;
};

const normalizeLanguage = (lang?: string) => {
    const input = (lang || "").toLowerCase();

    if (!input) return "plaintext";
    if (input === "js") return "javascript";
    if (input === "ts") return "typescript";
    if (input === "py") return "python";
    if (input === "sh") return "bash";

    return input;
};

const escapeHtml = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const downloadTextFile = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
    const toast = useToasts();
    const normalizedLanguage = normalizeLanguage(language);
    const cacheKey = `${normalizedLanguage}:${code}`;
    const [html, setHtml] = useState<string>(
        highlightedHtmlCache.get(cacheKey) || "",
    );

    useEffect(() => {
        let isCancelled = false;

        const cached = highlightedHtmlCache.get(cacheKey);

        if (cached) {
            setHtml(cached);
            return () => {
                isCancelled = true;
            };
        }

        const runHighlight = async () => {
            try {
                const highlighter = await getHighlighter();
                const loadedLanguages = highlighter
                    .getLoadedLanguages()
                    .map((lang) => String(lang));
                const langToUse = loadedLanguages.includes(normalizedLanguage)
                    ? normalizedLanguage
                    : "plaintext";

                const highlighted = highlighter.codeToHtml(code, {
                    lang: langToUse,
                    theme: "dark-plus",
                });

                if (!isCancelled) {
                    highlightedHtmlCache.set(cacheKey, highlighted);
                    setHtml(highlighted);
                }
            } catch {
                if (!isCancelled) {
                    const fallback = `<pre class="shiki" style="background-color:#1e1e1e;color:#d4d4d4"><code>${escapeHtml(code)}</code></pre>`;
                    highlightedHtmlCache.set(cacheKey, fallback);
                    setHtml(fallback);
                }
            }
        };

        void runHighlight();

        return () => {
            isCancelled = true;
        };
    }, [cacheKey, code, normalizedLanguage]);

    const languageLabel = normalizedLanguage.toUpperCase();

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success(MsgToasts.COPY_SUCCESS());
        } catch {
            // noop
        }
    };

    const buildDownloadFilename = () => {
        const fileId =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        return `${fileId}.${normalizedLanguage}`;
    };

    const handleDownload = () => {
        downloadTextFile(code, buildDownloadFilename());
    };

    if (!html) {
        return (
            <div className="mb-2 overflow-hidden rounded-xl border border-main-400/20 bg-main-900/80 last:mb-0">
                <div className="flex items-center justify-between border-b border-main-400/20 bg-main-800/70 p-2">
                    <span className="text-[11px] uppercase tracking-wide text-main-300">
                        {languageLabel}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="secondary"
                            label="Download code"
                            shape="rounded-lg"
                            className="p-1"
                            onClick={handleDownload}
                        >
                            <Icon icon="mdi:download" width="14" height="14" />
                        </Button>
                        <Button
                            variant="secondary"
                            label="Copy code"
                            shape="rounded-lg"
                            className="p-1"
                            onClick={copyCode}
                        >
                            <Icon
                                icon="mdi:content-copy"
                                width="14"
                                height="14"
                            />
                        </Button>
                    </div>
                </div>
                <div className="p-3">
                    <div className="h-18 w-full animate-pulse rounded-lg bg-main-800/70" />
                </div>
            </div>
        );
    }

    return (
        <div className="mb-2 overflow-hidden rounded-xl border border-main-400/20 bg-[#1e1e1e] last:mb-0">
            <div className="flex items-center justify-between border-b border-main-400/20 bg-main-700/60 p-2">
                <span className="text-[11px] uppercase tracking-wide text-main-300">
                    {languageLabel}
                </span>
                <div className="flex items-center gap-1">
                    <Button
                        variant="secondary"
                        label="Download code"
                        shape="rounded-lg"
                        className="gap-1 p-1 text-xs"
                        onClick={handleDownload}
                    >
                        <Icon icon="mdi:download" width="14" height="14" />
                        Скачать
                    </Button>
                    <Button
                        variant="secondary"
                        label="Copy code"
                        shape="rounded-lg"
                        className="gap-1 p-1 text-xs"
                        onClick={copyCode}
                    >
                        <Icon icon="mdi:content-copy" width="14" height="14" />
                        Копировать
                    </Button>
                </div>
            </div>
            <div className="overflow-x-auto p-3 [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:text-xs [&_pre]:leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        </div>
    );
}
