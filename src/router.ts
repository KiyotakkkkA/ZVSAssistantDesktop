import { createElement } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./presentation/layouts/MainLayout";
import { WelcomePage } from "./presentation/pages/WelcomePage";
import { ChatViewPage } from "./presentation/pages/workspace/ChatViewPage";
import { AgentsViewPage } from "./presentation/pages/agents/AgentsViewPage";
import { ScenariosViewPage } from "./presentation/pages/scenarios/ScenariosViewPage";
import { ExtensionsViewPage } from "./presentation/pages/extensions/ExtensionsViewPage";
import { StorageViewPage } from "./presentation/pages/storage/StorageViewPage";

export const router = createHashRouter([
    {
        path: "/",
        element: createElement(MainLayout),
        children: [
            {
                index: true,
                element: createElement(Navigate, {
                    to: "/welcome",
                    replace: true,
                }),
            },
            {
                path: "welcome",
                element: createElement(WelcomePage),
            },
            {
                path: "workspace",
                element: createElement(ChatViewPage),
            },
            {
                path: "agents",
                element: createElement(AgentsViewPage),
            },
            {
                path: "scenarios",
                element: createElement(ScenariosViewPage),
            },
            {
                path: "extensions",
                element: createElement(ExtensionsViewPage),
            },
            {
                path: "storage",
                element: createElement(StorageViewPage),
            },
        ],
    },
]);
