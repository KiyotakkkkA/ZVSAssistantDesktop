import type { UpdateUserDto } from "../models/user";
import type { UserRepository } from "../repositories/UserRepository";
import type { ThemesService } from "../services/ThemesService";
import { handleManyIpc } from "./ipcUtils";

export const registerIpcProfilePack = ({
    themesService,
    userRepository,
}: {
    themesService: ThemesService;
    userRepository: UserRepository;
}) => {
    const buildProfileBootPayload = () => {
        const user = userRepository.findCurrentUser();

        if (!user) {
            throw new Error("Current user is not found");
        }

        return {
            user,
            themeData: {
                list: themesService.getThemesList(),
                current: themesService.getThemeData(
                    user.generalData.preferredTheme,
                ),
            },
        };
    };

    handleManyIpc([
        [
            "profile:boot",
            () => {
                return buildProfileBootPayload();
            },
        ],
        [
            "profile:update",
            (id: string, data: UpdateUserDto) => {
                userRepository.updateUser(id, data);

                return buildProfileBootPayload();
            },
        ],
        [
            "theme:get-data",
            (themeName: string) => {
                return themesService.getThemeData(themeName);
            },
        ],
    ]);
};
