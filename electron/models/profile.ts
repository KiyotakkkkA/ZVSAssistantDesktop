import type { ThemeData } from "../static/themes/types";
import type { User } from "./user";

export type ProfileBootPayload = {
    user: User;
    themeData: {
        list: Omit<ThemeData, "palette">[];
        current: ThemeData;
    };
};
