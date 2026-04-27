import { Icon } from "@iconify/react";
import { Button, Modal, Select } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useEffect, useMemo, useState } from "react";
import type { SecretEntity } from "../../../../../stores/secretsStore";
import { secretsStore } from "../../../../../stores/secretsStore";

type SecretsSelectFillingProps = {
    open: boolean;
    secretType: string;
    title?: string;
    fieldLabel?: string;
    fieldIcon?: string;
    onClose: () => void;
    onSubmit: (value: string) => void;
};

export const SecretsSelectFilling = ({
    open,
    secretType,
    title,
    fieldLabel,
    fieldIcon,
    onClose,
    onSubmit,
}: SecretsSelectFillingProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [availableSecrets, setAvailableSecrets] = useState<SecretEntity[]>(
        [],
    );
    const [selectedSecretId, setSelectedSecretId] = useState("");

    useEffect(() => {
        if (!open) {
            return;
        }

        let isCancelled = false;

        setIsLoading(true);
        setSelectedSecretId("");

        void secretsStore
            .getSecretsByType(secretType)
            .then((secrets) => {
                if (isCancelled) {
                    return;
                }

                setAvailableSecrets(secrets);
            })
            .finally(() => {
                if (isCancelled) {
                    return;
                }

                setIsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [open, secretType]);

    const options = useMemo(
        () =>
            availableSecrets.map((secret) => ({
                value: secret.id,
                label: secret.name,
            })),
        [availableSecrets],
    );

    const selectedSecret = availableSecrets.find(
        (item) => item.id === selectedSecretId,
    );

    const isSubmitDisabled = isLoading || !selectedSecretId;

    const handleSubmit = () => {
        if (!selectedSecret) {
            return;
        }

        onSubmit(selectedSecret.secret);
    };

    return (
        <Modal open={open} onClose={onClose} className="max-w-2xl">
            <Modal.Header>
                {title || "Заполнение из менеджера секретов"}
            </Modal.Header>

            <Modal.Content>
                <div className="space-y-4">
                    {availableSecrets.length === 0 && !isLoading && (
                        <div className="rounded-xl border border-main-700/70 bg-main-900/45 px-3 py-2 text-sm text-main-300">
                            Для типа {secretType} пока нет сохраненных секретов.
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="mb-2 flex items-center gap-2 text-main-100">
                            <Icon
                                icon={fieldIcon || "mdi:form-select"}
                                width={14}
                                height={14}
                            />
                            <p className="text-sm font-semibold">
                                {fieldLabel || "Выберите значение"}
                            </p>
                        </div>

                        <Select
                            value={selectedSecretId}
                            onChange={setSelectedSecretId}
                            options={options}
                            classNames={{
                                menu: "border border-main-700/70 shadow-lg bg-main-900/92 backdrop-blur-md",
                                trigger: "bg-main-700/45",
                            }}
                        />
                    </div>
                </div>
            </Modal.Content>

            <Modal.Footer>
                <Button
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    onClick={onClose}
                >
                    Отмена
                </Button>
                <Button
                    variant="primary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    disabled={isSubmitDisabled}
                    onClick={handleSubmit}
                >
                    Заполнить поля
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
