import type { ScenariosService } from "../services/chat/ScenariosService";
import type { UserProfileService } from "../services/userData/UserProfileService";
import type {
    CreateScenarioPayload,
    UpdateScenarioPayload,
} from "../../src/types/Scenario";
import { handleIpc, handleManyIpc } from "./ipcUtils";

export type IpcScenariosPackDeps = {
    scenariosService: ScenariosService;
    userProfileService: UserProfileService;
};

export const registerIpcScenariosPack = ({
    scenariosService,
    userProfileService,
}: IpcScenariosPackDeps) => {
    handleManyIpc([
        ["app:get-scenarios-list", () => scenariosService.getScenariosList()],
    ]);

    handleIpc("app:get-scenario-by-id", (scenarioId: string) => {
        const scenario = scenariosService.getScenarioById(scenarioId);

        if (scenario) {
            userProfileService.updateUserProfile({
                activeScenarioId: scenario.id,
                lastActiveTab: "scenario",
                activeDialogId: null,
                activeProjectId: null,
            });
        } else {
            userProfileService.updateUserProfile({
                activeScenarioId: null,
            });
        }

        return scenario;
    });

    handleIpc("app:create-scenario", (payload: CreateScenarioPayload) => {
        const scenario = scenariosService.createScenario(payload);

        userProfileService.updateUserProfile({
            activeScenarioId: scenario.id,
            lastActiveTab: "scenario",
            activeDialogId: null,
            activeProjectId: null,
        });

        return scenario;
    });

    handleIpc(
        "app:update-scenario",
        (scenarioId: string, payload: UpdateScenarioPayload) => {
            const scenario = scenariosService.updateScenario(
                scenarioId,
                payload,
            );

            if (scenario) {
                userProfileService.updateUserProfile({
                    activeScenarioId: scenario.id,
                    lastActiveTab: "scenario",
                    activeDialogId: null,
                    activeProjectId: null,
                });
            }

            return scenario;
        },
    );

    handleIpc("app:delete-scenario", (scenarioId: string) => {
        const deletedScenario = scenariosService.deleteScenario(scenarioId);

        if (deletedScenario) {
            const profile = userProfileService.getUserProfile();

            if (profile.activeScenarioId === deletedScenario.id) {
                userProfileService.updateUserProfile({
                    activeScenarioId: null,
                    lastActiveTab: "dialogs",
                });
            }
        }

        return {
            scenarios: scenariosService.getScenariosList(),
            deletedScenarioId: scenarioId,
        };
    });
};
