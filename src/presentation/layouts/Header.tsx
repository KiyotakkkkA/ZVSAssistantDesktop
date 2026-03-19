import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib";

export const Header = () => {
    return (
        <header className="flex items-center gap-3 justify-end">
            <Button variant="secondary" className="p-1.5 border-transparent">
                <Icon icon="mdi:cog-outline" width={22} />
            </Button>
        </header>
    );
};
