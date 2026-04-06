import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { useState } from "react";

export const StorageFilesSelectPanel = () => {
    const [searchQuery, setSearchQuery] = useState("");
    return (
        <section className="flex h-full">
            <aside className="w-1/4 p-4 border-r border-main-600/55">
                <InputSmall
                    placeholder="Поиск файлов по имени или ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </aside>
            <div className="w-3/4 p-4">Контент</div>
        </section>
    );
};
