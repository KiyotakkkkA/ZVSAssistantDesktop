import { action, makeAutoObservable, runInAction, toJS } from "mobx";
import type { AgentEntity, CreateAgentDto } from "../../electron/models/agent";
import {
    getBaseModelEntries,
    getBaseModelList,
    setCustomAgents,
} from "../data/BaseModels";

class AgentsStore {
    customAgents: AgentEntity[] = [];
    isLoading = false;
    isBootstrapped = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(
            this,
            {
                bootstrap: action.bound,
                addAgent: action.bound,
            },
            { autoBind: true },
        );
    }

    get agents() {
        return getBaseModelList();
    }

    get agentEntries() {
        return getBaseModelEntries();
    }

    async bootstrap() {
        runInAction(() => {
            this.isLoading = true;
            this.error = null;
        });

        try {
            const agents = await window.agents.getAgents();

            runInAction(() => {
                this.customAgents = agents;
                setCustomAgents(toJS(agents));
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        } catch (error) {
            runInAction(() => {
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to load agents";
                this.isBootstrapped = true;
                this.isLoading = false;
            });
        }
    }

    async addAgent(payload: CreateAgentDto) {
        const created = await window.agents.createAgent(payload);

        runInAction(() => {
            this.customAgents = [created, ...this.customAgents];
            setCustomAgents(toJS(this.customAgents));
            this.error = null;
        });

        return created;
    }
}

export const agentsStore = new AgentsStore();
