import { Switcher } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";
import {
    StorageConnectorsSelectPanel,
    StorageFilesSelectPanel,
    StorageVecstoresSelectPanel,
} from "../../components/organisms/storage";

type AllowedOptions = "vecstor" | "files" | "connectors";

const options: { value: AllowedOptions; label: string }[] = [
    { value: "vecstor", label: "Векторные хранилища" },
    { value: "files", label: "Файлы" },
    { value: "connectors", label: "Коннекторы данных" },
];

export const StorageViewPage = () => {
    const [selectedOption, setSelectedOption] = useState<AllowedOptions>(
        options[0].value,
    );

    const handleOptionChange = (value: string) => {
        setSelectedOption(value as AllowedOptions);
    };

    const renderSection = (option: AllowedOptions) => {
        switch (option) {
            case "vecstor":
                return <StorageVecstoresSelectPanel />;
            case "files":
                return <StorageFilesSelectPanel />;
            case "connectors":
                return <StorageConnectorsSelectPanel />;
        }
    };

    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl mb-3">Хранилище</h1>
                <Switcher
                    options={options}
                    value={selectedOption}
                    onChange={handleOptionChange}
                    className="border-transparent"
                />
            </div>
            {renderSection(selectedOption)}
        </div>
    );
};
