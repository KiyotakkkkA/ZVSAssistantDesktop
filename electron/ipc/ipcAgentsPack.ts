import type { CreateAgentDto } from "../models/agent";
import type { AgentsRepository } from "../repositories/AgentsRepository";
import { handleManyIpc } from "./ipcUtils";

interface IpcAgentsPackDeps {
    agentsRepository: AgentsRepository;
}

export const registerIpcAgentsPack = ({
    agentsRepository,
}: IpcAgentsPackDeps) => {
    handleManyIpc([
        ["agents:get", () => agentsRepository.findAll()],
        [
            "agents:create",
            (payload: CreateAgentDto) => agentsRepository.createAgent(payload),
        ],
    ]);
};
