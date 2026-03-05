import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { createHighlighter } from "shiki";
import { Button } from "../../atoms";
import { useToasts } from "../../../../hooks";
import { useFileDownload } from "../../../../hooks/files";

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

export function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
    const toasts = useToasts();
    const normalizedLanguage = normalizeLanguage(language);
    const downloadCode = useFileDownload(code, `${normalizedLanguage}.txt`);
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
                const langToUse = highlighter
                    .getLoadedLanguages()
                    .includes(normalizedLanguage)
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

        runHighlight();

        return () => {
            isCancelled = true;
        };
    }, [cacheKey, code, normalizedLanguage]);

    const languageLabel = normalizedLanguage.toUpperCase();

    const copyMessage = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            toasts.success({
                title: "Скопировано",
                description: "Сообщение скопировано в буфер обмена.",
            });
        } catch {
            toasts.danger({
                title: "Ошибка копирования",
                description: "Не удалось скопировать сообщение.",
            });
        }
    };

    const buildDownloadFilename = () => {
        const fileId =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        return `${fileId}.${normalizedLanguage}`;
    };

    const handleDownload = () => {
        downloadCode(buildDownloadFilename());
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
                            onClick={() => copyMessage(code)}
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
                        className="p-1 text-xs gap-1"
                        onClick={handleDownload}
                    >
                        <Icon icon="mdi:download" width="14" height="14" />
                        Скачать
                    </Button>
                    <Button
                        variant="secondary"
                        label="Copy code"
                        shape="rounded-lg"
                        className="p-1 text-xs gap-1"
                        onClick={() => copyMessage(code)}
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
