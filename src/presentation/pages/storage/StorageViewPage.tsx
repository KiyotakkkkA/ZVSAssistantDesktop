import { InputSmall, Switcher } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";

type AllowedOptions = "vecstor" | "files" | "connectors";

const options: { value: AllowedOptions; label: string }[] = [
    { value: "vecstor", label: "Векторные хранилища" },
    { value: "files", label: "Файлы" },
    { value: "connectors", label: "Коннекторы данных" },
];

const switchContent: Record<AllowedOptions, { search_placeholder: string }> = {
    vecstor: {
        search_placeholder: "Поиск векторных хранилищ по имени или ID...",
    },
    files: {
        search_placeholder: "Поиск файлов по имени или ID...",
    },
    connectors: {
        search_placeholder: "Поиск папок с данными по имени...",
    },
};

export const StorageViewPage = () => {
    const [selectedOption, setSelectedOption] = useState<AllowedOptions>(
        options[0].value,
    );
    const [searchQuery, setSearchQuery] = useState("");

    const handleOptionChange = (value: string) => {
        setSearchQuery("");
        setSelectedOption(value as AllowedOptions);
    };

    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl mb-3">Хранилище</h1>
                <Switcher
                    options={options}
                    value={selectedOption}
                    onChange={handleOptionChange}
                    className="border-transparent"
                />
            </div>
            <section className="flex h-full">
                <aside className="w-1/4 p-4 border-r border-main-600/55">
                    <InputSmall
                        placeholder={
                            switchContent[selectedOption].search_placeholder
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </aside>
                <div className="w-3/4 p-4">Контент</div>
            </section>
        </div>
    );
};
