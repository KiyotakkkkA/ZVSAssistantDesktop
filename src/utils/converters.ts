export const convertFileToBase64 = async (file: File): Promise<string> => {
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

type ConvertBytesToSizeOptions = {
    inputUnit?: "B" | "KB" | "MB";
    fractionDigits?: number;
};

const SIZE_MULTIPLIER_BY_UNIT: Record<
    NonNullable<ConvertBytesToSizeOptions["inputUnit"]>,
    number
> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
};

export const convertBytesToSize = (
    value: number,
    options: ConvertBytesToSizeOptions = {},
) => {
    const { inputUnit = "B", fractionDigits = 1 } = options;
    const bytes = value * SIZE_MULTIPLIER_BY_UNIT[inputUnit];

    if (bytes < 1024) {
        return `${Math.round(bytes)} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(fractionDigits)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(fractionDigits)} MB`;
};
