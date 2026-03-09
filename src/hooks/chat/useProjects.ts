import { useCallback, useEffect } from "react";
import { projectsStore } from "../../stores/projectsStore";
import type { CreateProjectPayload } from "../../types/Project";

export const useProjects = () => {
    useEffect(() => {
        void projectsStore.initialize();
    }, []);

    const createProject = useCallback(async (payload: CreateProjectPayload) => {
        return projectsStore.createProject(payload);
    }, []);

    const switchProject = useCallback(async (projectId: string) => {
        if (!projectId) {
            return null;
        }

        return projectsStore.switchProject(projectId);
    }, []);

    const deleteProject = useCallback(async (projectId: string) => {
        if (!projectId) {
            return false;
        }

        return projectsStore.deleteProject(projectId);
    }, []);

    const updateProjectVectorStorage = useCallback(
        async (projectId: string, vecStorId: string | null) => {
            if (!projectId) {
                return null;
            }

            return projectsStore.updateProjectVectorStorage(
                projectId,
                vecStorId,
            );
        },
        [],
    );

    return {
        isReady: projectsStore.isReady,
        projects: projectsStore.projects,
        activeProject: projectsStore.activeProject,
        activeProjectId: projectsStore.activeProject?.id ?? "",
        createProject,
        switchProject,
        deleteProject,
        updateProjectVectorStorage,
        clearActiveProject: projectsStore.clearActiveProject,
    };
};
