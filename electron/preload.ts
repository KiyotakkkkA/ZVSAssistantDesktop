import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args;
        return ipcRenderer.on(channel, (event, ...nextArgs) =>
            listener(event, ...nextArgs),
        );
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.off(channel, ...nextArgs);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.send(channel, ...nextArgs);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.invoke(channel, ...nextArgs);
    },
});

contextBridge.exposeInMainWorld("chat", {
    generateResponse(params: {
        prompt: string;
        model: string;
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
    }) {
        return ipcRenderer.invoke("chat:generate", params);
    },
    streamResponseGeneration(params: {
        requestId: string;
        prompt: string;
        model: string;
        messages?: Array<{ role: "user" | "assistant"; content: string }>;
    }) {
        ipcRenderer.send("chat:stream:start", params);
    },
    onStreamEvent(
        listener: (payload: {
            requestId: string;
            part: { type: string; text?: string; error?: string };
        }) => void,
    ) {
        const wrappedListener = (_event: unknown, payload: unknown) => {
            listener(
                payload as {
                    requestId: string;
                    part: { type: string; text?: string; error?: string };
                },
            );
        };

        ipcRenderer.on("chat:stream:event", wrappedListener);

        return () => {
            ipcRenderer.off("chat:stream:event", wrappedListener);
        };
    },
});

contextBridge.exposeInMainWorld("profile", {
    boot() {
        return ipcRenderer.invoke("profile:boot");
    },
    update(
        id: string,
        data: {
            generalData?: {
                name: string;
                preferredTheme: string;
                preferredLanguage: string;
                userPrompt: string;
            };
            secureData?: {
                ollamaApiKey: string;
            };
        },
    ) {
        return ipcRenderer.invoke("profile:update", id, data);
    },
    getThemeData(themeName: string) {
        return ipcRenderer.invoke("theme:get-data", themeName);
    },
});
