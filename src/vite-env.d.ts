/// <reference types="vite/client" />

import type { AppApi } from "./types/ElectronApi";

interface ImportMetaEnv {}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare global {
    interface Window {
        appApi: AppApi;
    }
}

export {};
