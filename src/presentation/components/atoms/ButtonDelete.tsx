import { Icon } from "@iconify/react";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useState } from "react";

interface ButtonDeleteProps {
    label?: string;
    size?: number;
    labelModal?: string;
    className?: string;
    disabled?: boolean;
    confirm?: boolean;
    deleteFn: () => void;
}

export const ButtonDelete = ({
    label,
    disabled,
    size = 22,
    confirm = false,
    className,
    deleteFn,
}: ButtonDeleteProps) => {
    const [delModalOpen, setDelModalOpen] = useState(false);

    return (
        <>
            <Button
                variant="danger"
                shape="rounded-md"
                disabled={disabled}
                onClick={() => {
                    if (confirm) {
                        setDelModalOpen(true);
                        return;
                    }
                    deleteFn();
                }}
                className={`gap-2 p-1 text-sm ${className}`}
            >
                <Icon icon="mdi:delete" width={size} height={size} />
                {label && <span>{label}</span>}
            </Button>

            <Modal
                open={delModalOpen && confirm}
                onClose={() => setDelModalOpen(false)}
                title="Подтвердите удаление"
                className="max-w-md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={() => setDelModalOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="danger"
                            shape="rounded-lg"
                            className="h-9 px-4"
                            onClick={deleteFn}
                        >
                            Удалить
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-main-300">
                    Подтвердите удаление выбранного элемента.
                </p>
            </Modal>
        </>
    );
};
