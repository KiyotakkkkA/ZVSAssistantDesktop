export type AuthUser = {
    id?: string;
    email: string;
    roles: string[];
    status: string;
};

export type LoginBody = {
    email: string;
    password: string;
};

export type RegisterBody = {
    login: string;
    password: string;
    email?: string;
    name?: string;
};

export type LogoutBody = {
    refreshToken: string;
};

export type AuthSession = {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string;
    userAgent?: string;
    ip?: string;
    ipAddress?: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    device?: string;
    isCurrent?: boolean;
};

export type AuthSessionResponse = {
    accessToken: string;
    refreshToken: string;
    user?: AuthUser | null;
};

export type AuthSessionsResponse = {
    sessions: AuthSession[];
};
