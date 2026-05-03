import ReactDOM from "react-dom/client";
import {
    StyleProvider,
    ToastProvider,
} from "@kiyotakkkka/zvs-uikit-lib/providers";

import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <StyleProvider>
        <ToastProvider>
            <App />
        </ToastProvider>
    </StyleProvider>,
);
