import { Icon } from "@iconify/react";
import { Button, InputSmall, PrettyBR } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useState } from "react";
import type { StorageVecstoreEntity } from "../../../../../../electron/models/storage";

type StorageVecstoresSidebarProps = {
    vecstores: StorageVecstoreEntity[];
    selectedVecstoreId: string | null;
    onCreateVecstore: () => void;
    onSelectVecstore: (vecstoreId: string) => void;
};

export const StorageVecstoresSidebar = ({
    vecstores,
    selectedVecstoreId,
    onCreateVecstore,
    onSelectVecstore,
}: StorageVecstoresSidebarProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredVecstores = vecstores.filter((vecstore) =>
        vecstore.name.toLowerCase().includes(normalizedQuery),
    );

    return (
        <aside className="w-1/5 p-4 border-r border-main-600/55">
            <InputSmall
                placeholder="Поиск векторных хранилищ по имени"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
                variant="primary"
                className="mt-4 w-full p-1 gap-2 animate-card-rise-in"
                shape="rounded-lg"
                onClick={onCreateVecstore}
            >
                <Icon icon="mdi:plus-circle-outline " width={22} height={22} />
                Создать векторное хранилище
            </Button>
            <PrettyBR
                icon="mdi:database"
                label="Векторные хранилища "
                className="mt-5 animate-card-rise-in"
            />

            <div className="max-h-[calc(100%-16rem)] flex-1 rounded-2xl p-2 overflow-y-auto animate-card-rise-in">
                {filteredVecstores.length > 0 ? (
                    <div className="space-y-2">
                        {filteredVecstores.map((vecstore) => (
                            <button
                                key={vecstore.id}
                                type="button"
                                onClick={() => onSelectVecstore(vecstore.id)}
                                className={`w-full rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                    vecstore.id === selectedVecstoreId
                                        ? "bg-main-600/70"
                                        : "bg-main-900/45 hover:bg-main-700/70"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm text-main-100">
                                            {vecstore.name}
                                        </p>
                                        <p className="truncate text-[11px] text-main-400">
                                            {vecstore.folder_id}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-main-300">
                                        {vecstore.entities_count}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <Icon
                            icon="mdi:database-search-outline"
                            width={48}
                            height={48}
                            className="text-main-500"
                        />
                        <p className="text-sm text-main-300">
                            Хранилищ пока нет
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
};
