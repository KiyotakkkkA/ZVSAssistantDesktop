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
    ]);
};
