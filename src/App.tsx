import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { useNotifications } from "./hooks";

function App() {
    useNotifications();

    return <RouterProvider router={router} />;
}

export default App;
