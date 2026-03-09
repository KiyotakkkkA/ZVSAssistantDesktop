import { makeAutoObservable, runInAction } from "mobx";
import type {
    CreateProjectPayload,
    Project,
    ProjectListItem,
} from "../types/Project";
import { chatsStore } from "./chatsStore";

class ProjectsStore {
    isReady = false;
    projects: ProjectListItem[] = [];
    activeProject: Project | null = null;

    private isInitializing = false;

    constructor() {
        makeAutoObservable(this, {}, { autoBind: true });
    }

    async initialize(): Promise<void> {
        if (this.isReady || this.isInitializing) {
            return;
        }

        this.isInitializing = true;

        try {
            const api = window.appApi;

            if (!api) {
                runInAction(() => {
                    this.isReady = true;
                });
                return;
            }

            const [projects, bootData] = await Promise.all([
                api.projects.getProjectsList(),
                api.boot.getBootData(),
            ]);

            const activeProjectId = bootData.userProfile.activeProjectId;
            const activeProject = activeProjectId
                ? await api.projects.getProjectById(activeProjectId)
                : null;

            runInAction(() => {
                this.projects = projects;
                this.activeProject = activeProject;
                this.isReady = true;
            });
        } finally {
            runInAction(() => {
                this.isInitializing = false;
            });
        }
    }

    async createProject(
        payload: CreateProjectPayload,
    ): Promise<Project | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const project = await api.projects.createProject(payload);
        await chatsStore.switchDialog(project.dialogId);

        runInAction(() => {
            this.activeProject = project;
            this.upsertProjectListItem(project);
        });

        return project;
    }

    async switchProject(projectId: string): Promise<Project | null> {
        const project = await this.loadProject(projectId);

        if (!project) {
            return null;
        }

        await chatsStore.switchDialog(project.dialogId);
        return project;
    }

    async loadProject(projectId: string): Promise<Project | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const project = await api.projects.getProjectById(projectId);

        if (!project) {
            return null;
        }

        runInAction(() => {
            this.activeProject = project;
        });

        return project;
    }

    async deleteProject(projectId: string): Promise<boolean> {
        const api = window.appApi;

        if (!api) {
            return false;
        }

        const result = await api.projects.deleteProject(projectId);

        runInAction(() => {
            this.projects = result.projects;

            if (this.activeProject?.id === projectId) {
                this.activeProject = null;
            }
        });

        return true;
    }

    async updateProjectVectorStorage(
        projectId: string,
        vecStorId: string | null,
    ): Promise<Project | null> {
        const api = window.appApi;

        if (!api) {
            return null;
        }

        const updatedProject = await api.projects.updateProjectVectorStorage(
            projectId,
            vecStorId,
        );

        if (!updatedProject) {
            return null;
        }

        runInAction(() => {
            if (this.activeProject?.id === updatedProject.id) {
                this.activeProject = updatedProject;
            }

            this.upsertProjectListItem(updatedProject);
        });

        return updatedProject;
    }

    clearActiveProject(): void {
        this.activeProject = null;
    }

    private upsertProjectListItem(project: Project): void {
        const item: ProjectListItem = {
            id: project.id,
            title: project.name,
            preview: project.description.trim() || "Проект без описания",
            time: new Date(project.updatedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
            }),
            updatedAt: project.updatedAt,
            dialogId: project.dialogId,
        };

        const next = [
            item,
            ...this.projects.filter((existing) => existing.id !== project.id),
        ];

        next.sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
        );

        this.projects = next;
    }
}

export const projectsStore = new ProjectsStore();
