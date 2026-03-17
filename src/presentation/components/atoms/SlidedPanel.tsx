import type { ReactNode } from "react";
import { Icon } from "@iconify/react";

type SlidedPanelProps = {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    onClose?: () => void;
    children: ReactNode;
    widthClassName?: string;
    className?: string;
    bodyClassName?: string;
    modalMode?: boolean;
    containerClassName?: string;
};

export function SlidedPanel({
    isOpen,
    title,
    subtitle,
    onClose,
    children,
    widthClassName = "w-96",
    className = "",
    bodyClassName = "",
    modalMode = false,
    containerClassName = "",
}: SlidedPanelProps) {
    const stateClasses = isOpen
        ? "translate-x-0 opacity-100 pointer-events-auto"
        : "translate-x-8 opacity-0 pointer-events-none";

    if (modalMode) {
        return (
            <div
                aria-hidden={!isOpen}
                className={`pointer-events-none absolute inset-0 z-40 ${containerClassName}`}
            >
                <button
                    type="button"
                    aria-label="Закрыть панель"
                    className={`absolute inset-0 bg-main-950/45 backdrop-blur-[3px] transition-opacity duration-300 ${isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
                    onClick={() => onClose?.()}
                />

                <section
                    className={`absolute inset-y-0 right-0 flex h-full flex-col overflow-hidden border-l border-main-600/70 bg-main-900/95 shadow-[-16px_0_60px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 ${widthClassName} ${stateClasses} ${className}`}
                >
                    <header className="flex items-center justify-between border-b border-main-700/70 bg-linear-to-r from-main-800/70 via-main-800/45 to-main-900/35 px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-main-100">
                                {title}
                            </p>
                            {subtitle ? (
                                <p className="truncate text-xs text-main-400">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>

                        {onClose ? (
                            <button
                                type="button"
                                aria-label="Закрыть панель"
                                className="rounded-md p-1 text-main-300 transition-colors hover:bg-main-700/70 hover:text-main-100"
                                onClick={onClose}
                            >
                                <Icon icon="mdi:close" width={18} height={18} />
                            </button>
                        ) : null}
                    </header>

                    <div className={`min-h-0 flex-1 p-4 ${bodyClassName}`}>
                        {children}
                    </div>
                </section>
            </div>
        );
    }

    return (
        <section
            aria-hidden={!isOpen}
            className={`overflow-hidden rounded-2xl border border-main-600/70 bg-main-900/95 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-300 ${widthClassName} ${stateClasses} ${className}`}
        >
            <header className="flex items-center justify-between border-b border-main-700/70 bg-linear-to-r from-main-800/70 via-main-800/45 to-main-900/35 px-3 py-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-main-100">
                        {title}
                    </p>
                    {subtitle ? (
                        <p className="truncate text-[11px] text-main-400">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                {onClose ? (
                    <button
                        type="button"
                        aria-label="Закрыть панель"
                        className="rounded-md p-1 text-main-300 transition-colors hover:bg-main-700/70 hover:text-main-100"
                        onClick={onClose}
                    >
                        <Icon icon="mdi:close" width={18} height={18} />
                    </button>
                ) : null}
            </header>

            <div className={`p-3 ${bodyClassName}`}>{children}</div>
        </section>
    );
}
