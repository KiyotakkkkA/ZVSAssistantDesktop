import path from "node:path";

export type ElectronPaths = {
    basePath: string;
    resourcesPath: string;
    themesPath: string;
};

export const createElectronPaths = (basePath: string): ElectronPaths => {
    const resourcesPath = path.join(basePath, "resources");

    return {
        basePath,
        resourcesPath,
        themesPath: path.join(resourcesPath, "themes"),
    };
};
