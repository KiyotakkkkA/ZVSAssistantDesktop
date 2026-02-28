import { createElement } from "react";
import { createHashRouter, Navigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { NavigationMenuLayout } from "./presentation/layouts/NavigationMenuLayout";
import { ChatPage } from "./presentation/pages/workspace/ChatPage";
import { CreateProjectPage } from "./presentation/pages/workspace/projects/CreateProjectPage";
import { WorkspaceLayout } from "./presentation/layouts/WorkspaceLayout";
import { ProjectPage } from "./presentation/pages/workspace/projects/ProjectPage";
import { CreateScenarioPage } from "./presentation/pages/workspace/scenario/CreateScenarioPage";
import { ScenarioPage } from "./presentation/pages/workspace/scenario/ScenarioPage";
import { StoragePage } from "./presentation/pages/storage/StoragePage";
import { ExtViewPage } from "./presentation/pages/ext/ExtViewPage";
import { LoadingFallbackPage } from "./presentation/pages/LoadingFallbackPage";
import { userProfileStore } from "./stores/userProfileStore";

const HomeRedirect = observer(function HomeRedirect() {
    if (!userProfileStore.isReady) {
        return createElement(LoadingFallbackPage, {
            title: "Подготовка рабочей области...",
        });
    }

    const { activeProjectId, activeScenarioId, lastActiveTab } =
        userProfileStore.userProfile;
    const targetPath =
        lastActiveTab === "scenario" && activeScenarioId
            ? `/workspace/scenario/${activeScenarioId}`
            : lastActiveTab === "projects" && activeProjectId
              ? `/workspace/projects/${activeProjectId}`
              : "/workspace/dialogs";

    return createElement(Navigate, {
        to: targetPath,
        replace: true,
    });
});

export const router = createHashRouter([
    {
        path: "/",
        element: createElement(NavigationMenuLayout),
        children: [
            {
                index: true,
                element: createElement(Navigate, {
                    to: "/workspace",
                    replace: true,
                }),
            },
            {
                path: "workspace",
                element: createElement(WorkspaceLayout),
                children: [
                    {
                        index: true,
                        element: createElement(HomeRedirect),
                    },
                    {
                        path: "dialogs",
                        element: createElement(ChatPage),
                    },
                    {
                        path: "projects",
                        element: createElement(Navigate, {
                            to: "/workspace/projects/create",
                            replace: true,
                        }),
                    },
                    {
                        path: "projects/create",
                        element: createElement(CreateProjectPage),
                    },
                    {
                        path: "projects/:projectId",
                        element: createElement(ProjectPage),
                    },
                    {
                        path: "scenario",
                        element: createElement(Navigate, {
                            to: "/workspace/scenario/create",
                            replace: true,
                        }),
                    },
                    {
                        path: "scenario/create",
                        element: createElement(CreateScenarioPage),
                    },
                    {
                        path: "scenario/:scenarioId",
                        element: createElement(ScenarioPage),
                    },
                ],
            },
            {
                path: "storage",
                element: createElement(StoragePage),
            },
            {
                path: "ext",
                element: createElement(ExtViewPage),
            },
        ],
    },
]);
