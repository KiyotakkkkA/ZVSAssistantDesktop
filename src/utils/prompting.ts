export const compact = (value: string) => value.replace(/\s+/g, " ").trim();

export const section = (title: string, lines: string[]) => {
    const content = lines.map((line) => `- ${compact(line)}`).join("\n");
    return `${title}:\n${content}`;
};

export const unique = (values: string[]) => [...new Set(values.map(compact))];
