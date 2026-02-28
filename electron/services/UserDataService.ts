import type {
    BootData,
    ThemeData,
    ThemeListItem,
    UserProfile,
} from "../../src/types/App";
import type {
    ChatDialog,
    ChatDialogListItem,
    DeleteDialogResult,
} from "../../src/types/Chat";
import { randomUUID } from "node:crypto";
import type { UploadedFileData } from "../../src/types/ElectronApi";
import type { AppCacheEntry } from "../../src/types/ElectronApi";
import type { SavedFileRecord } from "../../src/types/ElectronApi";
import type {
    UpdateVectorStoragePayload,
    VectorTagRecord,
    VectorStorageRecord,
} from "../../src/types/ElectronApi";
import type {
    CreateProjectPayload,
    DeleteProjectResult,
    Project,
    ProjectListItem,
} from "../../src/types/Project";
import type {
    CreateScenarioPayload,
    DeleteScenarioResult,
    Scenario,
    ScenarioListItem,
    UpdateScenarioPayload,
} from "../../src/types/Scenario";
import type { ElectronPaths } from "../paths";
import path from "node:path";
import { UserProfileService } from "./userData/UserProfileService";
import { ThemesService } from "./userData/ThemesService";
import { DialogsService } from "./userData/DialogsService";
import { ProjectsService } from "./userData/ProjectsService";
import { ScenariosService } from "./userData/ScenariosService";
import { MetaService } from "./userData/MetaService";
import { FileStorageService } from "./storage/FileStorageService";
import { DatabaseService } from "./storage/DatabaseService";

export class UserDataService {
    private readonly userProfileService: UserProfileService;
    private readonly themesService: ThemesService;
    private readonly dialogsService: DialogsService;
    private readonly projectsService: ProjectsService;
    private readonly scenariosService: ScenariosService;
    private readonly fileStorageService: FileStorageService;
    private readonly databaseService: DatabaseService;
    private readonly defaultProjectsDirectory: string;
    private readonly vectorIndexPath: string;

    constructor(paths: ElectronPaths) {
        this.defaultProjectsDirectory = paths.defaultProjectsDirectory;
        this.vectorIndexPath = paths.vectorIndexPath;

        this.databaseService = new DatabaseService(paths.databasePath);
        const metaService = new MetaService(paths.metaPath);

        this.userProfileService = new UserProfileService(
            this.databaseService,
            metaService,
        );
        const currentUserId = this.userProfileService.getCurrentUserId();
        this.themesService = new ThemesService(paths.themesPath);
        this.dialogsService = new DialogsService(
            this.databaseService,
            ({ activeDialogId, activeProjectId }) => {
                this.userProfileService.updateUserProfile({
                    activeDialogId,
                    activeProjectId,
                    activeScenarioId: null,
                    lastActiveTab: activeProjectId ? "projects" : "dialogs",
                });
            },
            currentUserId,
        );
        this.projectsService = new ProjectsService(
            this.databaseService,
            currentUserId,
        );
        this.scenariosService = new ScenariosService(
            this.databaseService,
            currentUserId,
        );
        this.fileStorageService = new FileStorageService(
            paths.filesPath,
            this.databaseService,
            currentUserId,
        );

        this.syncProjectDialogs();
    }

    getActiveDialog(): ChatDialog {
        const profile = this.userProfileService.getUserProfile();
        return this.dialogsService.getActiveDialog(
            profile.activeDialogId ?? undefined,
        );
    }

    getDialogsList(): ChatDialogListItem[] {
        return this.dialogsService.getDialogsList();
    }

    getDialogById(dialogId: string): ChatDialog {
        const profile = this.userProfileService.getUserProfile();
        return this.dialogsService.getDialogById(
            dialogId,
            profile.activeDialogId ?? undefined,
        );
    }

    createDialog(): ChatDialog {
        return this.dialogsService.createDialog();
    }

    renameDialog(dialogId: string, nextTitle: string): ChatDialog {
        const profile = this.userProfileService.getUserProfile();
        return this.dialogsService.renameDialog(
            dialogId,
            nextTitle,
            profile.activeDialogId ?? undefined,
        );
    }

    deleteDialog(dialogId: string): DeleteDialogResult {
        return this.dialogsService.deleteDialog(dialogId);
    }

    deleteMessageFromDialog(dialogId: string, messageId: string): ChatDialog {
        const profile = this.userProfileService.getUserProfile();
        return this.dialogsService.deleteMessageFromDialog(
            dialogId,
            messageId,
            profile.activeDialogId ?? undefined,
        );
    }

    truncateDialogFromMessage(dialogId: string, messageId: string): ChatDialog {
        const profile = this.userProfileService.getUserProfile();
        return this.dialogsService.truncateDialogFromMessage(
            dialogId,
            messageId,
            profile.activeDialogId ?? undefined,
        );
    }

    saveDialogSnapshot(dialog: ChatDialog): ChatDialog {
        return this.dialogsService.saveDialogSnapshot(dialog);
    }

    getProjectsList(): ProjectListItem[] {
        return this.projectsService.getProjectsList();
    }

    getProjectById(projectId: string): Project | null {
        const project = this.projectsService.getProjectById(projectId);

        if (project) {
            this.userProfileService.updateUserProfile({
                activeProjectId: project.id,
                activeScenarioId: null,
                lastActiveTab: "projects",
            });
        } else {
            this.userProfileService.updateUserProfile({
                activeProjectId: null,
            });
        }

        return project;
    }

    getDefaultProjectsDirectory(): string {
        return this.defaultProjectsDirectory;
    }

    createProject(payload: CreateProjectPayload): Project {
        const projectId = `project_${randomUUID().replace(/-/g, "")}`;
        const dialog = this.dialogsService.createDialog(projectId);
        const nextTitle = payload.name.trim();
        const selectedBaseDirectory =
            payload.directoryPath?.trim() || this.defaultProjectsDirectory;

        if (nextTitle) {
            this.dialogsService.renameDialog(dialog.id, nextTitle);
        }

        const project = this.projectsService.createProject({
            ...payload,
            directoryPath: selectedBaseDirectory,
            dialogId: dialog.id,
            projectId,
        });

        this.userProfileService.updateUserProfile({
            activeScenarioId: null,
            lastActiveTab: "projects",
        });

        return project;
    }

    deleteProject(projectId: string): DeleteProjectResult {
        const deletedProject = this.projectsService.deleteProject(projectId);

        if (deletedProject) {
            this.fileStorageService.deleteFilesByIds(deletedProject.fileUUIDs);
            this.dialogsService.deleteDialog(deletedProject.dialogId);

            const profile = this.userProfileService.getUserProfile();

            if (profile.activeProjectId === projectId) {
                this.userProfileService.updateUserProfile({
                    activeProjectId: null,
                    activeScenarioId: null,
                    lastActiveTab: "dialogs",
                });
            }
        }

        return {
            projects: this.projectsService.getProjectsList(),
            deletedProjectId: projectId,
        };
    }

    getScenariosList(): ScenarioListItem[] {
        return this.scenariosService.getScenariosList();
    }

    getScenarioById(scenarioId: string): Scenario | null {
        const scenario = this.scenariosService.getScenarioById(scenarioId);

        if (scenario) {
            this.userProfileService.updateUserProfile({
                activeScenarioId: scenario.id,
                lastActiveTab: "scenario",
                activeDialogId: null,
                activeProjectId: null,
            });
        } else {
            this.userProfileService.updateUserProfile({
                activeScenarioId: null,
            });
        }

        return scenario;
    }

    createScenario(payload: CreateScenarioPayload): Scenario {
        const scenario = this.scenariosService.createScenario(payload);

        this.userProfileService.updateUserProfile({
            activeScenarioId: scenario.id,
            lastActiveTab: "scenario",
            activeDialogId: null,
            activeProjectId: null,
        });

        return scenario;
    }

    updateScenario(
        scenarioId: string,
        payload: UpdateScenarioPayload,
    ): Scenario | null {
        const scenario = this.scenariosService.updateScenario(
            scenarioId,
            payload,
        );

        if (scenario) {
            this.userProfileService.updateUserProfile({
                activeScenarioId: scenario.id,
                lastActiveTab: "scenario",
                activeDialogId: null,
                activeProjectId: null,
            });
        }

        return scenario;
    }

    deleteScenario(scenarioId: string): DeleteScenarioResult {
        const deletedScenario =
            this.scenariosService.deleteScenario(scenarioId);

        if (deletedScenario) {
            const profile = this.userProfileService.getUserProfile();

            if (profile.activeScenarioId === deletedScenario.id) {
                this.userProfileService.updateUserProfile({
                    activeScenarioId: null,
                    lastActiveTab: "dialogs",
                });
            }
        }

        return {
            scenarios: this.scenariosService.getScenariosList(),
            deletedScenarioId: scenarioId,
        };
    }

    saveFiles(files: UploadedFileData[]): SavedFileRecord[] {
        return this.fileStorageService.saveFiles(files);
    }

    getFilesByIds(fileIds: string[]): SavedFileRecord[] {
        return this.fileStorageService.getFilesByIds(fileIds);
    }

    getAllFiles(): SavedFileRecord[] {
        return this.fileStorageService.getAllFiles();
    }

    getVectorStorages(): VectorStorageRecord[] {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.getVectorStorages(currentUserId);
    }

    getVectorStorageById(vectorStorageId: string): VectorStorageRecord | null {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.getVectorStorageById(
            vectorStorageId,
            currentUserId,
        );
    }

    createVectorStorage(): VectorStorageRecord {
        const currentUserId = this.userProfileService.getCurrentUserId();
        const vectorStorageName = `store_${randomUUID().replace(/-/g, "")}`;

        const vectorStorageId = `vs_${randomUUID().replace(/-/g, "")}`;
        const defaultDataPath = path.join(
            this.vectorIndexPath,
            `${vectorStorageId}.lance`,
        );

        return this.databaseService.createVectorStorage(
            currentUserId,
            vectorStorageName,
            defaultDataPath,
            vectorStorageId,
        );
    }

    getVectorTags(): VectorTagRecord[] {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.getVectorTags(currentUserId);
    }

    createVectorTag(name: string): VectorTagRecord | null {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.createVectorTag(currentUserId, name);
    }

    updateVectorStorage(
        vectorStorageId: string,
        payload: UpdateVectorStoragePayload,
    ): VectorStorageRecord | null {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.updateVectorStorage(
            vectorStorageId,
            payload,
            currentUserId,
        );
    }

    deleteVectorStorage(vectorStorageId: string): boolean {
        const currentUserId = this.userProfileService.getCurrentUserId();
        return this.databaseService.deleteVectorStorage(
            vectorStorageId,
            currentUserId,
        );
    }

    getFileById(fileId: string): SavedFileRecord | null {
        return this.fileStorageService.getFileById(fileId);
    }

    deleteFileById(fileId: string): boolean {
        return this.fileStorageService.deleteFileById(fileId);
    }

    getBootData(): Omit<BootData, "extensions"> {
        const userProfile = this.userProfileService.getUserProfile();
        const preferredThemeData = this.themesService.resolveThemePalette(
            userProfile.themePreference,
        );

        return {
            userProfile,
            preferredThemeData,
        };
    }

    getThemesList(): ThemeListItem[] {
        return this.themesService.getThemesList();
    }

    getCurrentUserId(): string {
        return this.userProfileService.getCurrentUserId();
    }

    getDatabaseService(): DatabaseService {
        return this.databaseService;
    }

    getThemeData(themeId: string): ThemeData {
        return this.themesService.getThemeData(themeId);
    }

    updateUserProfile(nextProfile: Partial<UserProfile>): UserProfile {
        return this.userProfileService.updateUserProfile(nextProfile);
    }

    private syncProjectDialogs(): void {
        const projects = this.projectsService.getProjectsList();

        for (const project of projects) {
            this.dialogsService.linkDialogToProject(
                project.dialogId,
                project.id,
            );
        }
    }

    getCacheEntry(key: string): AppCacheEntry | null {
        return this.databaseService.getCacheEntry(key) as AppCacheEntry | null;
    }

    setCacheEntry(key: string, entry: AppCacheEntry): void {
        this.databaseService.setCacheEntry(key, entry);
    }
}
