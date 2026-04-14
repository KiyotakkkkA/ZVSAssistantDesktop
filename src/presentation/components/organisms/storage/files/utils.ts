export const formatFolderSize = (size: number) => `${size.toFixed(2)} MB`;

export const formatStorageFileSize = (sizeMb: number) => {
    if (sizeMb >= 1) {
        return `${sizeMb.toFixed(2)} MB`;
    }

    return `${Math.round(sizeMb * 1024)} KB`;
};

export const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;

            if (typeof result !== "string") {
                reject(new Error("Не удалось прочитать файл"));
                return;
            }

            const [, base64 = ""] = result.split(",", 2);
            resolve(base64);
        };

        reader.onerror = () => {
            reject(new Error("Не удалось прочитать файл"));
        };

        reader.readAsDataURL(file);
    });
};
