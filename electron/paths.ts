import path from "node:path";

export type ElectronPaths = {
    basePath: string;
    resourcesPath: string;
    themesPath: string;
    databasePath: string;
    storagePath: string;
};

export const createElectronPaths = (basePath: string): ElectronPaths => {
    const resourcesPath = path.join(basePath, "resources");

    return {
        basePath,
        resourcesPath,
        storagePath: path.join(resourcesPath, "storage"),
        themesPath: path.join(resourcesPath, "themes"),
        databasePath: path.join(resourcesPath, "db.zvsdatabase"),
    };
};
