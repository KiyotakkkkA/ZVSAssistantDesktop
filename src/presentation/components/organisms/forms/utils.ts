export const parseIgnorePatterns = (rawValue: string): string[] => {
    return rawValue
        .split(/[\n,;]+/)
        .map((value) => value.trim())
        .filter(Boolean);
};

export const resolveDefaultFolderName = (repoPath: string): string => {
    const normalized = repoPath.trim().replace(/\.git$/i, "");

    if (!normalized) {
        return "repository";
    }

    const pathParts = normalized.split("/").filter(Boolean);

    return pathParts.at(-1) || normalized;
};
