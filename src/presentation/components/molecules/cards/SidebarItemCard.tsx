import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { ButtonDelete } from "../../atoms";

export type PlaceholderItem = {
    id: string;
    title: string;
    time: string;
    active?: boolean;
    onSelect: (id: string) => void;
    onRename: (id: string) => void;
    submitDelete: (id: string) => void;
};

export const SidebarItem = ({
    id,
    title,
    time,
    active,
    onSelect,
    onRename,
    submitDelete,
}: PlaceholderItem) => {
    return (
        <div
            onClick={() => onSelect?.(id)}
            className={`rounded-2xl px-3 py-1.5 transition-colors cursor-pointer ${
                active
                    ? "bg-main-700/70"
                    : "bg-transparent hover:bg-main-700/40"
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-main-100">
                    {title}
                </p>
                <div className="flex items-center gap-2 text-sm text-main-400">
                    <span>{time}</span>
                    <Button
                        variant=""
                        className="h-7 w-7 rounded-md hover:bg-main-600/40 border-transparent hover:text-main-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRename?.(id);
                        }}
                    >
                        <Icon
                            icon="mdi:pencil-outline"
                            width={16}
                            height={16}
                        />
                    </Button>
                    <ButtonDelete
                        ghost
                        confirm
                        className="h-7 w-7 rounded-md hover:bg-red-400/15 border-transparent hover:text-red-400 text-main-400/75"
                        deleteFn={() => submitDelete(id)}
                    />
                </div>
            </div>
        </div>
    );
};
