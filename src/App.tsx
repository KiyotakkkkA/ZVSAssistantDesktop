import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { profileStore } from "./stores/profileStore";
import { secretsStore } from "./stores/secretsStore";
import { storageStore } from "./stores/storageStore";

export default function App() {
    useEffect(() => {
        void profileStore.bootstrap();
        void secretsStore.bootstrap();
        void storageStore.bootstrap();
    }, []);

    return <RouterProvider router={router} />;
}
