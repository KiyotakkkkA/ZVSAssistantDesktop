import { Icon } from "@iconify/react";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import {
    useMe,
    useSessions,
} from "../../../../hooks";
import { hasAuthTokensInLocalStorage } from "../../../../services/api/authTokens";
import { userStore } from "../../../../stores/userStore";
import type { AuthSession } from "../../../../types/Auth";
import { Button, InputSmall, Loader } from "../../atoms";

type SettingsZvsAccountPanelProps = {
    email: string;
    password: string;
    isLoading?: boolean;
    isLogoutLoading?: boolean;
    updateDraft: (
        nextDraft: Partial<{ email: string; password: string }>,
    ) => void;
    onLogin?: () => void;
    onLogout?: () => void;
};

const formatDate = (value?: string) => {
    if (!value) {
        return "Неизвестно";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Неизвестно";
    }

    return date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const timeAgo = (value?: string) => {
    if (!value) {
        return "Неизвестно";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Неизвестно";
    }

    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
        const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return `${diffMinutes} мин. назад`;
    }

    if (diffHours < 24) {
        return `${diffHours} ч. назад`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн. назад`;
};

const SessionCard = ({ session }: { session: AuthSession }) => {
    return (
        <article className="rounded-2xl border border-main-700/50 bg-main-800/40 p-4 transition-colors hover:border-main-600/60">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-main-100">
                        {session.browser ?? "Браузер"} на {session.os ?? "OS"}
                    </p>
                    <p className="text-xs text-main-400">
                        {session.device || session.deviceType || "Устройство"}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-main-300">
                <p>
                    <span className="text-main-500">IP:</span>{" "}
                    {session.ipAddress || session.ip || "Неизвестно"}
                </p>
                <p>
                    <span className="text-main-500">Создана:</span>{" "}
                    {timeAgo(session.createdAt)}
                </p>
                <p>
                    <span className="text-main-500">Истекает:</span>{" "}
                    {formatDate(session.expiresAt)}
                </p>
            </div>
        </article>
    );
};

export const SettingsZvsAccountPanel = observer(
    function SettingsZvsAccountPanel({
        email,
        password,
        isLoading = false,
        isLogoutLoading = false,
        updateDraft,
        onLogin,
        onLogout,
    }: SettingsZvsAccountPanelProps) {
        const hasTokens = hasAuthTokensInLocalStorage();
        const meQuery = useMe({
            enabled: hasTokens,
        });
        const sessionsQuery = useSessions({
            enabled: hasTokens,
        });

        const user = meQuery.data ?? userStore.user;
        const sessions = sessionsQuery.data ?? [];
        const emailInitial = (user?.email?.[0] ?? "U").toUpperCase();
        const roles = useMemo(
            () => (Array.isArray(user?.roles) ? user.roles : []),
            [user?.roles],
        );

        return (
            <div className="flex min-h-full flex-col gap-5">
                {!hasTokens && (
                    <div className="rounded-2xl bg-main-900/40 p-4 relative">
                        <img
                            src="/images/logo.svg"
                            alt="ZVS"
                            className="pointer-events-none absolute right-4 top-4 h-10 w-10 opacity-35"
                            draggable={false}
                        />

                        <h4 className="text-sm font-semibold text-main-100">
                            ZVS Профиль
                        </h4>

                        <div className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-main-200">
                                    Email
                                </p>
                                <InputSmall
                                    value={email}
                                    onChange={(event) =>
                                        updateDraft({
                                            email: event.target.value,
                                        })
                                    }
                                    placeholder="Введите email"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium text-main-200">
                                    Пароль
                                </p>
                                <InputSmall
                                    value={password}
                                    type="password"
                                    onChange={(event) =>
                                        updateDraft({
                                            password: event.target.value,
                                        })
                                    }
                                    placeholder="Введите пароль"
                                />
                            </div>

                            <div className="pt-1 flex items-center gap-2">
                                {!hasTokens ? (
                                    <Button
                                        variant="primary"
                                        shape="rounded-lg"
                                        className="h-9 px-4 text-sm"
                                        onClick={() => {
                                            onLogin?.();
                                        }}
                                        disabled={
                                            isLoading ||
                                            email.trim().length === 0 ||
                                            password.length === 0
                                        }
                                    >
                                        {isLoading ? "Вход..." : "Вход"}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}

                {hasTokens ? (
                    <div className="rounded-2xl border border-main-700/50 bg-main-900/20 p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-main-700/60 text-base font-semibold text-main-100">
                                {emailInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-lg font-semibold text-main-100">
                                    {user?.email || "Пользователь"}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {roles.map((role) => (
                                        <span
                                            key={role}
                                            className="inline-flex items-center gap-1 rounded-md bg-main-700/40 px-2 py-0.5 text-[11px] uppercase tracking-wider text-main-300"
                                        >
                                            <Icon
                                                icon="mdi:shield-account-outline"
                                                width={12}
                                                height={12}
                                            />
                                            {role}
                                        </span>
                                    ))}
                                    {user?.status ? (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/30 px-2 py-0.5 text-[11px] uppercase tracking-wider text-emerald-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                            {user.status}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <Button
                                variant="danger"
                                shape="rounded-lg"
                                className="p-2 text-sm ml-auto"
                                onClick={() => {
                                    onLogout?.();
                                }}
                                disabled={isLogoutLoading}
                            >
                                {isLogoutLoading ? (
                                    <Loader className="text-main-100" />
                                ) : (
                                    <Icon
                                        icon="mdi:logout"
                                        width={16}
                                        height={16}
                                    />
                                )}
                            </Button>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <Icon
                                    icon="mdi:shield-lock-outline"
                                    className="text-main-400"
                                    width={16}
                                    height={16}
                                />
                                <h5 className="text-xs font-medium uppercase tracking-[0.14em] text-main-400">
                                    Активные сессии
                                </h5>
                                <span className="rounded-md bg-main-700/50 px-1.5 py-0.5 text-[10px] text-main-300">
                                    {sessions.length}
                                </span>
                            </div>

                            {meQuery.isError ? (
                                <div className="mt-3 rounded-xl border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-300">
                                    {meQuery.error.message}
                                </div>
                            ) : null}

                            {sessionsQuery.isError ? (
                                <div className="mt-3 rounded-xl border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-300">
                                    {sessionsQuery.error.message}
                                </div>
                            ) : null}

                            {sessionsQuery.isLoading ? (
                                <div className="mt-3 text-sm text-main-400">
                                    Загружаем сессии...
                                </div>
                            ) : sessions.length > 0 ? (
                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                    {sessions.map((session) => (
                                        <SessionCard
                                            key={session.id}
                                            session={session}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-3 rounded-xl border border-main-700/40 bg-main-800/30 p-4 text-sm text-main-400">
                                    Активные сессии не найдены.
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        );
    },
);
