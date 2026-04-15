export interface SecretEntity {
    id: string;
    type: string;
    name: string;
    secret: string;
    created_at: string;
    updated_at: string;
}

export type CreateSecretDto = {
    type: string;
    name: string;
    secret: string;
};
