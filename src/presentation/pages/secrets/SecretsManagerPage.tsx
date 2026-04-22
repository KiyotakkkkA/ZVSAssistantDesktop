import { useState } from "react";
import { Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { SecretsDataTable } from "../../components/organisms/secrets";
import { SecretsAddForm } from "../../components/organisms/secrets/forms";
import { MsgToasts } from "../../../data/MsgToasts";
import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { ButtonCreate } from "../../components/atoms";

export const SecretsManagerPage = () => {
    const toast = useToasts();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl">Менеджер секретов</h1>
            </div>
            <div className="p-4">
                <ButtonCreate
                    className="mb-4"
                    createFn={() => setIsAddModalOpen(true)}
                    label="Добавить секрет"
                ></ButtonCreate>
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
                    onSuccess={() => {
                        setIsAddModalOpen(false);
                        toast.success(MsgToasts.SECRET_SUCCESSFULLY_CREATED());
                    }}
                />
            </Modal>
        </div>
    );
};
