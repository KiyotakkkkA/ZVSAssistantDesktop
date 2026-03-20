import ReactDOM from "react-dom/client";
import { ToastProvider } from "./providers";

import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ToastProvider>
        <App />
    </ToastProvider>,
);
