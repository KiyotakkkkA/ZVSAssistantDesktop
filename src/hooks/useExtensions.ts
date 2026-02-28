import { useCallback } from "react";
import { useObserver } from "mobx-react-lite";
import { extensionsStore } from "../stores/extensionsStore";

export const useExtensions = () => {
    const refreshExtensions = useCallback(async () => {
        await extensionsStore.refresh();
    }, []);

    return useObserver(() => ({
        isLoading: extensionsStore.isLoading,
        extensions: extensionsStore.extensions,
        refreshExtensions,
        getExtensionById: extensionsStore.getById,
    }));
};
