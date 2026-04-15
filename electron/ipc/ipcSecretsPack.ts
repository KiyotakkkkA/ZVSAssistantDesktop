import type { CreateSecretDto } from "../models/secret";
import type { SecretsRepository } from "../repositories/SecretsRepository";
import { handleManyIpc } from "./ipcUtils";

interface IpcSecretsPackDeps {
    secretsRepository: SecretsRepository;
}

export const registerIpcSecretsPack = ({
    secretsRepository,
}: IpcSecretsPackDeps) => {
    handleManyIpc([
        ["secrets:get", () => secretsRepository.findAll()],
        [
            "secrets:get-by-type",
            (type: string) => secretsRepository.findByType(type),
        ],
        [
            "secrets:create",
            (payload: CreateSecretDto) =>
                secretsRepository.createSecret(payload),
        ],
        [
            "secrets:delete",
            (id: string) => {
                secretsRepository.deleteSecret(id);
            },
        ],
    ]);
};
