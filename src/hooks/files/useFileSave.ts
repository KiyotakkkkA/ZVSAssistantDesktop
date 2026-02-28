import { useCallback, useState } from "react";
import type {
    SavedFileRecord,
    UploadedFileData,
} from "../../types/ElectronApi";

export const useFileSave = () => {
    const [isSaving, setIsSaving] = useState(false);

    const saveFiles = useCallback(
        async (files: UploadedFileData[]): Promise<SavedFileRecord[]> => {
            const api = window.appApi?.files.saveFiles;

            if (!api || files.length === 0) {
                return [];
            }

            try {
                setIsSaving(true);
                return api(files);
            } finally {
                setIsSaving(false);
            }
        },
        [],
    );

    const getFilesByIds = useCallback(async (fileIds: string[]) => {
        const api = window.appApi?.files.getFilesByIds;

        if (!api || fileIds.length === 0) {
            return [];
        }

        return api(fileIds);
    }, []);

    const getAllFiles = useCallback(async (): Promise<SavedFileRecord[]> => {
        const api = window.appApi?.files.getAllFiles;

        if (!api) {
            return [];
        }

        return api();
    }, []);

    const openFile = useCallback(async (fileId: string): Promise<boolean> => {
        const api = window.appApi?.files.openFile;

        if (!api) {
            return false;
        }

        return api(fileId);
    }, []);

    const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
        const api = window.appApi?.files.deleteFile;

        if (!api) {
            return false;
        }

        return api(fileId);
    }, []);

    const openPath = useCallback(
        async (targetPath: string): Promise<boolean> => {
            const api = window.appApi?.files.openPath;

            if (!api) {
                return false;
            }

            return api(targetPath);
        },
        [],
    );

    return {
        isSaving,
        saveFiles,
        getAllFiles,
        getFilesByIds,
        deleteFile,
        openFile,
        openPath,
    };
};
