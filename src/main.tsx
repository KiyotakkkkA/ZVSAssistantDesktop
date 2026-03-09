import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { ThemeProvider, ToastProvider } from "./providers";

import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </ToastProvider>
        </QueryClientProvider>
    </React.StrictMode>,
);

window.ipcRenderer?.on?.("main-process-message", (_event, message) => {
    console.log(message);
});
