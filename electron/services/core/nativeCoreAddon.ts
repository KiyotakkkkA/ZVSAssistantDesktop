import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";

type NativeCoreAddon = {
    streamChat: (
        payloadJson: string,
        token: string,
        baseUrl?: string,
    ) => Promise<string>;
    streamChatCallback: (
        payloadJson: string,
        token: string,
        baseUrl: string | undefined | null,
        callback: (err: null | Error, chunk: string) => void,
    ) => Promise<void>;
    getEmbed: (
        payloadJson: string,
        token: string,
        baseUrl?: string,
    ) => Promise<string>;
    getBuiltinToolDefinitions: () => string;
};

let cachedAddon: NativeCoreAddon | null = null;

const resolveLoaderPath = () => {
    const basePath = path.resolve(process.cwd(), "native", "core");
    const cjsPath = path.join(basePath, "index.cjs");
    if (fs.existsSync(cjsPath)) {
        return cjsPath;
    }

    throw new Error(
        `Native core loader not found in ${basePath}. Run npm run build:core`,
    );
};

export const getNativeCoreAddon = (): NativeCoreAddon => {
    if (cachedAddon) {
        return cachedAddon;
    }

    const require = createRequire(import.meta.url);
    cachedAddon = require(resolveLoaderPath()) as NativeCoreAddon;
    return cachedAddon;
};
