export const normalizeWhitespace = (value: string) => {
    return value
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const decodeHtmlEntities = (value: string) => {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&hellip;/gi, "...");
};

export const extractHtmlLinks = (html: string, pageUrl: string): string[] => {
    const hrefRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
    const links = new Set<string>();

    for (const match of html.matchAll(hrefRegex)) {
        const rawHref = (match[1] ?? "").trim();
        if (!rawHref) {
            continue;
        }

        try {
            const absoluteUrl = new URL(rawHref, pageUrl).toString();
            links.add(absoluteUrl);
            if (links.size >= 20) {
                break;
            }
        } catch {
            // Ignore invalid links in malformed HTML.
        }
    }

    return Array.from(links);
};

export const extractHtmlTitle = (html: string): string => {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch) {
        return "";
    }

    return normalizeWhitespace(decodeHtmlEntities(titleMatch[1] ?? ""));
};

export const extractHtmlText = (html: string): string => {
    const withoutScripts = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(
            /<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi,
            " ",
        );

    const withBreaks = withoutScripts.replace(
        /<\/?(p|div|h1|h2|h3|h4|h5|h6|li|br|tr|section|article|main|header|footer|blockquote)\b[^>]*>/gi,
        "\n",
    );

    const rawText = withBreaks.replace(/<[^>]+>/g, " ");

    return normalizeWhitespace(decodeHtmlEntities(rawText));
};

export const parseJsonSafely = (raw: string): unknown => {
    try {
        return JSON.parse(raw);
    } catch {
        return {
            raw,
        };
    }
};
