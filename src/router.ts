import { createElement } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./presentation/layouts/MainLayout";
import { WorkspaceSidebar } from "./presentation/layouts/WorkspaceSidebar";
import { WelcomePage } from "./presentation/pages/WelcomePage";
import { ChatViewPage } from "./presentation/pages/workspace/chat/ChatViewPage";
import { AgentsViewPage } from "./presentation/pages/agents/AgentsViewPage";
import { ExtensionsViewPage } from "./presentation/pages/extensions/ExtensionsViewPage";
import { StorageViewPage } from "./presentation/pages/storage/StorageViewPage";
import { SecretsManagerPage } from "./presentation/pages/secrets/SecretsManagerPage";

export const router = createHashRouter([
    {
        path: "/",
        element: createElement(MainLayout),
        children: [
            {
                index: true,
                element: createElement(Navigate, {
                    to: "/workspace/chat",
                    replace: true,
                }),
            },
            {
                path: "welcome",
                element: createElement(WelcomePage),
            },
            {
                path: "workspace",
                element: createElement(WorkspaceSidebar),
                children: [
                    {
                        index: true,
                        element: createElement(Navigate, {
                            to: "chat",
                            replace: true,
                        }),
                    },
                    {
                        path: "chat",
                        element: createElement(ChatViewPage),
                    },
                ],
            },
            {
                path: "agents",
                element: createElement(AgentsViewPage),
            },
            {
                path: "extensions",
                element: createElement(ExtensionsViewPage),
            },
            {
                path: "storage",
                element: createElement(StorageViewPage),
            },
            {
                path: "secrets",
                element: createElement(SecretsManagerPage),
            },
        ],
    },
]);
