import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider, ToastProvider } from "./providers";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ToastProvider>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </ToastProvider>
    </React.StrictMode>,
);

window.ipcRenderer?.on?.("main-process-message", (_event, message) => {
    console.log(message);
});
