import { randomUUID } from "node:crypto";

import type { ProjectsService } from "../services/chat/ProjectsService";
import type { DialogsService } from "../services/chat/DialogsService";
import type { FileStorageService } from "../services/storage/FileStorageService";
import type { UserProfileService } from "../services/userData/UserProfileService";
import type { CreateProjectPayload } from "../../src/types/Project";
import { handleIpc, handleManyIpc } from "./ipcUtils";

export type IpcProjectsPackDeps = {
    projectsService: ProjectsService;
    dialogsService: DialogsService;
    fileStorageService: FileStorageService;
    userProfileService: UserProfileService;
    defaultProjectsDirectory: string;
};

export const registerIpcProjectsPack = ({
    projectsService,
    dialogsService,
    fileStorageService,
    userProfileService,
    defaultProjectsDirectory,
}: IpcProjectsPackDeps) => {
    handleManyIpc([
        ["app:get-projects-list", () => projectsService.getProjectsList()],
        ["app:get-default-projects-directory", () => defaultProjectsDirectory],
    ]);

    handleIpc("app:get-project-by-id", (projectId: string) => {
        const project = projectsService.getProjectById(projectId);

        if (project) {
            userProfileService.updateUserProfile({
                activeProjectId: project.id,
                activeScenarioId: null,
                lastActiveTab: "projects",
            });
        } else {
            userProfileService.updateUserProfile({
                activeProjectId: null,
            });
        }

        return project;
    });

    handleIpc("app:create-project", (payload: CreateProjectPayload) => {
        const projectId = `project_${randomUUID().replace(/-/g, "")}`;
        const dialog = dialogsService.createDialog(projectId);
        const nextTitle = payload.name.trim();
        const selectedBaseDirectory =
            payload.directoryPath?.trim() || defaultProjectsDirectory;

        if (nextTitle) {
            dialogsService.renameDialog(dialog.id, nextTitle);
        }

        const project = projectsService.createProject({
            ...payload,
            directoryPath: selectedBaseDirectory,
            dialogId: dialog.id,
            projectId,
        });

        userProfileService.updateUserProfile({
            activeScenarioId: null,
            lastActiveTab: "projects",
        });

        return project;
    });

    handleIpc("app:delete-project", (projectId: string) => {
        const deletedProject = projectsService.deleteProject(projectId);

        if (deletedProject) {
            fileStorageService.deleteFilesByIds(deletedProject.fileUUIDs);
            dialogsService.deleteDialog(deletedProject.dialogId);

            const profile = userProfileService.getUserProfile();

            if (profile.activeProjectId === projectId) {
                userProfileService.updateUserProfile({
                    activeProjectId: null,
                    activeScenarioId: null,
                    lastActiveTab: "dialogs",
                });
            }
        }

        return {
            projects: projectsService.getProjectsList(),
            deletedProjectId: projectId,
        };
    });

    handleIpc(
        "app:update-project-vector-storage",
        (projectId: string, vecStorId: string | null) => {
            return projectsService.updateProjectVectorStorage(
                projectId,
                vecStorId,
            );
        },
    );
};
