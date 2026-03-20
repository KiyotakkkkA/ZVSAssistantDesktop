import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { profileStore } from "./stores/profileStore";

export default function App() {
    useEffect(() => {
        void profileStore.bootstrap();
    }, []);

    return <RouterProvider router={router} />;
}
