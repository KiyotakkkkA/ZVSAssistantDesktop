import { Icon } from "@iconify/react";

export type PlaceholderItem = {
    id: string;
    title: string;
    preview: string;
    time: string;
    tokens?: string;
    active?: boolean;
};

export const SidebarItem = ({
    title,
    preview,
    time,
    tokens,
    active,
}: PlaceholderItem) => {
    return (
        <div
            className={`rounded-2xl p-3 transition-colors ${
                active
                    ? "bg-main-700/70"
                    : "bg-transparent hover:bg-main-800/60"
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-main-100">
                    {title}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-main-400">
                    {tokens ? <span>{tokens}</span> : null}
                    <span>{time}</span>
                    <Icon icon="mdi:pencil-outline" width="14" height="14" />
                    <Icon icon="mdi:delete-outline" width="14" height="14" />
                </div>
            </div>
            <p className="mt-1 truncate text-sm text-main-400">{preview}</p>
        </div>
    );
};
