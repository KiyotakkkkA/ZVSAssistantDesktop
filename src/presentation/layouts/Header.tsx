import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib";

export const Header = () => {
    return (
        <header className="flex items-center gap-3 justify-end">
            <Button
                variant=""
                className="p-1.5 border-transparent hover:bg-main-700/50"
            >
                <Icon icon="mdi:cog" width={22} />
            </Button>
        </header>
    );
};
