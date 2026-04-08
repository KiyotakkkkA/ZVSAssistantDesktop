import { Notification, shell } from "electron";
import { handleManyIpc } from "./ipcUtils";

export const registerIpcCorePack = () => {
    handleManyIpc([
        [
            "core:http-request",
            async (url: string, options?: RequestInit) => {
                const response = await fetch(url, options);
                const responseBody = await response.text();
                return responseBody;
            },
        ],
        [
            "core:show-os-notification",
            async (params: { title: string; body: string }) => {
                if (!Notification.isSupported()) {
                    return false;
                }

                const title = params?.title?.trim() || "Уведомление";
                const body = params?.body?.trim() || "";

                const notification = new Notification({
                    title,
                    body,
                    urgency: "normal",
                    silent: false,
                });

                notification.show();
                return true;
            },
        ],
        [
            "core:open-external",
            async (url: string) => {
                try {
                    const result = await shell.openExternal(url);
                    return {
                        success: true,
                        result,
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as Error).message,
                    };
                }
            },
        ],
        [
            "core:open-path",
            async (path: string) => {
                try {
                    const result = await shell.openPath(path);
                    return {
                        success: true,
                        result,
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as Error).message,
                    };
                }
            },
        ],
    ]);
};
