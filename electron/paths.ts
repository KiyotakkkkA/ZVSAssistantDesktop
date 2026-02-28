import path from "node:path";

export type ElectronPaths = {
    basePath: string;
    resourcesPath: string;
    extensionsPath: string;
    themesPath: string;
    filesPath: string;
    vectorIndexPath: string;
    metaPath: string;
    databasePath: string;
    defaultProjectsDirectory: string;
};

export const createElectronPaths = (basePath: string): ElectronPaths => {
    const resourcesPath = path.join(basePath, "resources");

    return {
        basePath,
        resourcesPath,
        extensionsPath: path.join(resourcesPath, "extensions"),
        themesPath: path.join(resourcesPath, "themes"),
        filesPath: path.join(resourcesPath, "files"),
        vectorIndexPath: path.join(resourcesPath, "vector-index"),
        metaPath: path.join(resourcesPath, "meta.json"),
        databasePath: path.join(resourcesPath, "db.zvsdatabase"),
        defaultProjectsDirectory: path.join(resourcesPath, "projects"),
    };
};
