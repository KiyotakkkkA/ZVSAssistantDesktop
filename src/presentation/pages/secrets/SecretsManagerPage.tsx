import { useState } from "react";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { SecretsDataTable } from "../../components/organisms/secrets";
import { Icon } from "@iconify/react";
import { SecretsAddForm } from "../../components/organisms/secrets/forms";

export const SecretsManagerPage = () => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl">Менеджер секретов</h1>
            </div>
            <div className="p-4">
                <Button
                    variant="primary"
                    shape="rounded-lg"
                    className="mb-4 p-1 gap-2"
                    onClick={() => setIsAddModalOpen(true)}
                >
                    <Icon icon="mdi:plus-circle-outline" />
                    Добавить секрет
                </Button>
                <SecretsDataTable />
            </div>

            <Modal
                open={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Добавить секрет"
                className="max-w-xl"
            >
                <SecretsAddForm
                    onCancel={() => setIsAddModalOpen(false)}
                    onSuccess={() => setIsAddModalOpen(false)}
                />
            </Modal>
        </div>
    );
};
