export const compact = (value: string) => value.replace(/\s+/g, " ").trim();

export const compactList = (values: string[]) => {
    const next: string[] = [];

    for (const value of values) {
        const normalized = compact(value);

        if (normalized) {
            next.push(normalized);
        }
    }

    return next;
};

export const section = (title: string, lines: string[]) => {
    const compactLines = compactList(lines);

    if (compactLines.length === 0) {
        return "";
    }

    const content = compactLines.map((line) => `- ${line}`).join("\n");
    return `${title}:\n${content}`;
};

export const unique = (values: string[]) => {
    const normalized = compactList(values);
    return [...new Set(normalized)];
};

export const joinBlocks = (blocks: string[], separator = "\n\n") =>
    blocks
        .map((block) => block.trim())
        .filter(Boolean)
        .join(separator);
