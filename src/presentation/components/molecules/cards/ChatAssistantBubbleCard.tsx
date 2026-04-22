import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge, ScrollArea, SlidedPanel } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { resolveText } from "../../../../utils/resolvers";
import { MarkdownStaticContent } from "../render";
import type { VecstoreSearchResult } from "../../../../../electron/models/chat";

type ChatAssistantBubbleCardProps = {
    content: string;
    sources?: VecstoreSearchResult[];
    timestamp?: string;
    isStreaming?: boolean;
    isError?: boolean;
};

export function ChatAssistantBubbleCard({
    content,
    sources = [],
    timestamp,
    isStreaming = false,
    isError = false,
}: ChatAssistantBubbleCardProps) {
    const [isSourcesPanelOpened, setIsSourcesPanelOpened] = useState(false);

    const safeContent = resolveText(content);
    const showStreamingPlaceholder = isStreaming && !safeContent.trim();
    const hasSources = sources.length > 0;

    return (
        <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-main-100">
            <div className={isError ? "text-red-300" : "text-main-100"}>
                {showStreamingPlaceholder ? (
                    <p className="typing-gradient-text text-sm">
                        Модель печатает...
                    </p>
                ) : (
                    <MarkdownStaticContent content={safeContent} />
                )}
            </div>
            {timestamp ? (
                <p className="mt-2 text-[11px] text-main-400">{timestamp}</p>
            ) : null}

            {hasSources ? (
                <div className="mt-3">
                    <button
                        type="button"
                        className="inline-flex"
                        onClick={() => setIsSourcesPanelOpened(true)}
                    >
                        <Badge
                            variant="info"
                            className="cursor-pointer border-transparent gap-2 px-3.5 py-1 text-[11px] bg-transparent hover:bg-main-700/50 text-purple-300 transition-colors"
                        >
                            <Icon
                                icon="mdi:book-open-page-variant-outline"
                                width={13}
                                height={13}
                            />
                            Источники: {sources.length}
                        </Badge>
                    </button>
                </div>
            ) : null}

            <SlidedPanel
                open={isSourcesPanelOpened}
                onClose={() => setIsSourcesPanelOpened(false)}
                title="Источники ответа"
                subtitle={`Найдено фрагментов: ${sources.length}`}
                classNames={{
                    width: "w-full max-w-2xl",
                    panel: "border-l border-main-700/70 bg-main-900 max-h-screen",
                }}
            >
                <ScrollArea className="h-full pr-1" orientation="vertical">
                    <div className="space-y-3">
                        {sources.map((source, index) => (
                            <article
                                key={`${source.vecstoreId}:${source.fileId}:${source.chunkIndex}:${index}`}
                                className="rounded-2xl border border-main-700/75 bg-main-800/45 p-3.5 transition hover:border-main-500/60"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="inline-flex items-center gap-1.5 rounded-full border border-main-600/70 bg-main-900/70 px-2.5 py-1">
                                        <Icon
                                            icon="mdi:source-branch"
                                            width={13}
                                            height={13}
                                            className="text-main-300"
                                        />
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-main-200">
                                            Источник {index + 1}
                                        </p>
                                    </div>

                                    <span className="inline-flex items-center gap-1 rounded-full border border-main-500/70 bg-main-900/80 px-2.5 py-1 text-[11px] font-semibold text-main-100">
                                        <Icon
                                            icon="mdi:shield-check-outline"
                                            width={12}
                                            height={12}
                                            className="text-main-300"
                                        />
                                        {source.confidencePercentage}%
                                    </span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-main-300">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-main-700/70 bg-main-900/60 px-2 py-0.5">
                                        <Icon
                                            icon="mdi:database-outline"
                                            width={12}
                                            height={12}
                                        />
                                        {source.vecstoreName}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-main-700/70 bg-main-900/60 px-2 py-0.5">
                                        <Icon
                                            icon="mdi:pound"
                                            width={12}
                                            height={12}
                                        />
                                        chunk {source.chunkIndex}
                                    </span>
                                </div>

                                <p className="mt-2 truncate text-xs text-main-400">
                                    {source.filePath}
                                </p>

                                <div className="mt-2 rounded-xl border border-main-700/60 bg-main-900/55 p-2.5">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-main-100">
                                        {source.content}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </ScrollArea>
            </SlidedPanel>
        </div>
    );
}
