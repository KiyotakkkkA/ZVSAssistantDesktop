import { makeAutoObservable } from "mobx";

type OpenedDialog = `dlg:${string}`;
type OpenedProject = `prj:${string}/dlg:${string}`;
export type lastOpenedState = OpenedDialog | OpenedProject;

export class GlobalStorage {
    lastOpened: lastOpenedState | null = null;

    constructor() {
        makeAutoObservable(this);
    }
}

export const globalStorage = new GlobalStorage();
