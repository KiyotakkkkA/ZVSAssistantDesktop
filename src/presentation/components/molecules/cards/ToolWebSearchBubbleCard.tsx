import { Icon } from "@iconify/react";
import { Accordeon, Loader } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { z } from "zod";
import type { ToolTrace } from "../../../../../electron/models/tool";

type ToolWebSearchBubbleCardProps = {
    toolTrace?: ToolTrace;
    isLoading?: boolean;
};

const webSearchDataResultSchema = z.object({
    ok: z.literal(true),
    data: z.array(
        z.object({
            url: z.string(),
        }),
    ),
});

const webSearchSummaryResultSchema = z.object({
    result: z.object({
        urls: z.array(z.string()),
    }),
});

const normalizeUrl = (value: string) => {
    try {
        const url = new URL(value);
        return {
            raw: value,
            host: url.hostname,
            origin: url.origin,
        };
    } catch {
        return null;
    }
};

const extractUrls = (result: unknown) => {
    const fromData = webSearchDataResultSchema.safeParse(result);

    if (fromData.success) {
        return fromData.data.data.map((item) => item.url);
    }

    const fromSummary = webSearchSummaryResultSchema.safeParse(result);

    if (fromSummary.success) {
        return fromSummary.data.result.urls;
    }

    return [];
};

export function ToolWebSearchBubbleCard({
    toolTrace,
    isLoading = false,
}: ToolWebSearchBubbleCardProps) {
    if (!toolTrace) {
        return null;
    }

    const rawUrls = extractUrls(toolTrace.result);
    const uniqueUrls = [...new Set(rawUrls)];
    const parsedUrls = uniqueUrls
        .map((url) => normalizeUrl(url))
        .filter((item) => item !== null);

    return (
        <div className="text-xs leading-relaxed text-main-200 animate-card-rise-in">
            <Accordeon className="max-w-172">
                <Accordeon.Summary>
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5 flex items-center gap-1.5 text-main-200">
                            <Icon icon="mdi:web" width={14} height={14} />
                            {isLoading ? <Loader className="h-3 w-3" /> : null}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-main-100">
                                Поиск в интернете
                            </p>
                            <p className="text-[11px] text-main-400">
                                Ссылки на сайты, из которых собраны данные
                            </p>
                        </div>
                    </div>
                </Accordeon.Summary>

                <Accordeon.Content>
                    {toolTrace.error ? (
                        <div className="rounded-xl border border-red-700/60 bg-red-950/20 px-3 py-2 text-[11px] text-red-300">
                            {toolTrace.error}
                        </div>
                    ) : null}

                    {!toolTrace.error && parsedUrls.length === 0 ? (
                        <p className="text-[11px] text-main-400">
                            Источники не найдены.
                        </p>
                    ) : null}

                    <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                        {parsedUrls.map((item) => (
                            <button
                                key={item.raw}
                                type="button"
                                className="flex cursor-pointer w-full items-center gap-2 rounded-xl border border-main-700/70 bg-main-900/55 px-2.5 py-2 text-left hover:bg-main-800/70"
                                onClick={() => {
                                    void window.core.openExternal(item.raw);
                                }}
                                title={item.raw}
                            >
                                <img
                                    src={`https://www.google.com/s2/favicons?domain=${item.host}&sz=64`}
                                    alt={item.host}
                                    className="h-4 w-4 rounded-sm"
                                />

                                <div className="min-w-0">
                                    <p className="truncate text-[11px] font-semibold text-main-200">
                                        {item.host}
                                    </p>
                                    <p className="truncate text-[11px] text-main-400">
                                        {item.raw}
                                    </p>
                                </div>

                                <span className="ml-auto shrink-0 text-main-400">
                                    <Icon
                                        icon="mdi:open-in-new"
                                        width={14}
                                        height={14}
                                    />
                                </span>
                            </button>
                        ))}
                    </div>
                </Accordeon.Content>
            </Accordeon>
        </div>
    );
}
