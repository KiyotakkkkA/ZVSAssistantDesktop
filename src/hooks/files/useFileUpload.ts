import { useCallback, useState } from "react";
import type { UploadedFileData } from "../../types/ElectronApi";

type UploadOptions = {
    accept?: string[];
    multiple?: boolean;
};

type PickPathOptions = {
    forFolders?: boolean;
};

export const useFileUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [isPickingPath, setIsPickingPath] = useState(false);

    const pickFiles = useCallback(
        async (options?: UploadOptions): Promise<UploadedFileData[]> => {
            const api = window.appApi?.upload.pickFiles;

            if (!api) {
                return [];
            }

            try {
                setIsUploading(true);
                return api(options);
            } finally {
                setIsUploading(false);
            }
        },
        [],
    );

    const pickPath = useCallback(
        async (options?: PickPathOptions): Promise<string | null> => {
            const api = window.appApi?.upload.pickPath;

            if (!api) {
                return null;
            }

            try {
                setIsPickingPath(true);
                return api(options);
            } finally {
                setIsPickingPath(false);
            }
        },
        [],
    );

    return {
        isUploading,
        isPickingPath,
        pickFiles,
        pickPath,
    };
};

export const useUpload = useFileUpload;
