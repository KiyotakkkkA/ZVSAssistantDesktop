import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";
import { Icon } from "@iconify/react";
import {
    ToastContext,
    type ToastContextValue,
    type ToastInput,
    type ToastType,
} from "./ToastContext";

type ToastItem = {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    durationMs: number;
};

const DEFAULT_DURATION = 3500;

const toastStyles: Record<
    ToastType,
    { icon: string; accent: string; progress: string; border: string }
> = {
    normal: {
        icon: "mdi:information-outline",
        accent: "text-main-200",
        progress: "bg-main-500",
        border: "border-main-600",
    },
    info: {
        icon: "mdi:information",
        accent: "text-sky-300",
        progress: "bg-sky-400",
        border: "border-sky-700/70",
    },
    warning: {
        icon: "mdi:alert-outline",
        accent: "text-amber-300",
        progress: "bg-amber-400",
        border: "border-amber-700/70",
    },
    success: {
        icon: "mdi:check-circle-outline",
        accent: "text-emerald-300",
        progress: "bg-emerald-400",
        border: "border-emerald-700/70",
    },
    danger: {
        icon: "mdi:close-circle-outline",
        accent: "text-rose-300",
        progress: "bg-rose-400",
        border: "border-rose-700/70",
    },
};

type ToastCardProps = {
    item: ToastItem;
    onDone: (id: string) => void;
};

const ToastCard = ({ item, onDone }: ToastCardProps) => {
    const [entered, setEntered] = useState(false);
    const [progressStarted, setProgressStarted] = useState(false);
    const style = toastStyles[item.type];

    useEffect(() => {
        requestAnimationFrame(() => {
            setEntered(true);
            setProgressStarted(true);
        });

        const timeout = window.setTimeout(() => {
            setEntered(false);

            window.setTimeout(() => {
                onDone(item.id);
            }, 220);
        }, item.durationMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [item.durationMs, item.id, onDone]);

    return (
        <div
            className={`relative overflow-hidden rounded-xl border ${style.border} bg-main-900 px-4 py-3 shadow-xl transition-all duration-200 ${
                entered
                    ? "translate-x-0 opacity-100"
                    : "translate-x-8 opacity-0"
            }`}
        >
            <div className="flex items-start gap-2 pr-2">
                <Icon
                    icon={style.icon}
                    width="24"
                    height="24"
                    className={style.accent}
                />

                <div className="min-w-0">
                    <p className="text-sm font-semibold text-main-100">
                        {item.title}
                    </p>
                    {item.description ? (
                        <p className="mt-1 text-xs text-main-300">
                            {item.description}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-main-800">
                <div
                    className={`h-full ${style.progress}`}
                    style={{
                        width: progressStarted ? "0%" : "100%",
                        transition: `width ${item.durationMs}ms linear`,
                    }}
                />
            </div>
        </div>
    );
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback((type: ToastType, input: ToastInput) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setToasts((prev) => [
            ...prev,
            {
                id,
                type,
                title: input.title,
                description: input.description,
                durationMs: input.durationMs ?? DEFAULT_DURATION,
            },
        ]);
    }, []);

    const contextValue = useMemo<ToastContextValue>(
        () => ({
            push,
            normal: (input) => push("normal", input),
            info: (input) => push("info", input),
            warning: (input) => push("warning", input),
            success: (input) => push("success", input),
            danger: (input) => push("danger", input),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            <div className="pointer-events-none fixed bottom-4 right-4 z-70 flex w-90 max-w-[calc(100vw-2rem)] flex-col gap-2">
                {toasts.map((item) => (
                    <ToastCard key={item.id} item={item} onDone={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};
