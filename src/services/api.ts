import { Config } from "../../electron/config";

export type OllamaCatalogModelDetails = {
    parent_model: string;
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
};

export type OllamaCatalogModel = {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: OllamaCatalogModelDetails;
};

export const getOllamaModelsCatalog = async (): Promise<
    OllamaCatalogModel[]
> => {
    const rawResponse = await window.core.httpRequest(
        `${Config.OLLAMA_BASE_URL}/api/tags`,
        {
            method: "GET",
            headers:
                import.meta.env.VITE_OLLAMA_API_KEY?.trim().length > 0
                    ? {
                          Authorization: `Bearer ${import.meta.env.VITE_OLLAMA_API_KEY}`,
                      }
                    : undefined,
        },
    );

    const parsed = JSON.parse(rawResponse) as {
        models?: OllamaCatalogModel[];
    };

    return parsed.models ?? [];
};
