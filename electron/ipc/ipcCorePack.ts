import type { UserProfileService } from "../services/userData/UserProfileService";
import type { ThemesService } from "../services/userData/ThemesService";
import type { ExtensionsService } from "../services/extensions/ExtensionsService";
import type { UserProfile } from "../../src/types/App";
import { handleManyIpc } from "./ipcUtils";

export type IpcCorePackDeps = {
    getBootData: () => {
        userProfile: ReturnType<UserProfileService["getUserProfile"]>;
        preferredThemeData: ReturnType<ThemesService["resolveThemePalette"]>;
    };
    extensionsService: ExtensionsService;
    getBuiltinToolPackages: () => string;
    themesService: ThemesService;
    userProfileService: UserProfileService;
};

export const registerIpcCorePack = ({
    getBootData,
    extensionsService,
    getBuiltinToolPackages,
    themesService,
    userProfileService,
}: IpcCorePackDeps) => {
    handleManyIpc([
        [
            "app:get-boot-data",
            async () => {
                const bootData = getBootData();
                const extensions = await extensionsService.getExtensionsState();

                return {
                    ...bootData,
                    extensions,
                };
            },
        ],
        [
            "app:get-extensions-state",
            () => extensionsService.getExtensionsState(),
        ],
        [
            "app:get-builtin-tool-packages",
            () => JSON.parse(getBuiltinToolPackages()) as unknown,
        ],
        ["app:get-themes-list", () => themesService.getThemesList()],
        [
            "app:get-theme-data",
            (themeId: string) => themesService.getThemeData(themeId),
        ],
        [
            "app:update-user-profile",
            (nextProfile: Partial<UserProfile>) =>
                userProfileService.updateUserProfile(nextProfile),
        ],
    ]);
};
