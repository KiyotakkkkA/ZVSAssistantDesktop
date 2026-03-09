export type ProjectLinkedVectorStorage = {
    id: string;
    name: string;
};

export type Project = {
    id: string;
    name: string;
    description: string;
    directoryPath: string;
    dialogId: string;
    vecStorId: string | null;
    fileUUIDs: string[];
    requiredTools: string[];
    linkedVectorStorage: ProjectLinkedVectorStorage | null;
    createdAt: string;
    updatedAt: string;
};

export type ProjectListItem = {
    id: string;
    title: string;
    preview: string;
    time: string;
    updatedAt: string;
    dialogId: string;
};

export type CreateProjectPayload = {
    name: string;
    description: string;
    directoryPath?: string;
    fileUUIDs: string[];
    requiredTools: string[];
};

export type DeleteProjectResult = {
    projects: ProjectListItem[];
    deletedProjectId: string;
};
