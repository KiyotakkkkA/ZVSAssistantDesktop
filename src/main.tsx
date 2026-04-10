import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./providers";
import { ToastProvider } from "@kiyotakkkka/zvs-uikit-lib/providers";

import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ToastProvider>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </ToastProvider>,
);
