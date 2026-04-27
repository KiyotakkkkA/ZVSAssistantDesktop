import { Icon } from "@iconify/react";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useState } from "react";

interface ButtonDeleteProps {
    label?: string;
    size?: number;
    ghost?: boolean;
    labelModal?: string;
    className?: string;
    disabled?: boolean;
    confirm?: boolean;
    deleteFn: () => void;
}

export const ButtonDelete = ({
    label,
    labelModal,
    disabled,
    size = 22,
    ghost = false,
    confirm = false,
    className,
    deleteFn,
}: ButtonDeleteProps) => {
    const [delModalOpen, setDelModalOpen] = useState(false);

    return (
        <>
            <Button
                variant={ghost ? "ghost" : "danger"}
                shape="rounded-md"
                disabled={disabled}
                onClick={(event) => {
                    event.stopPropagation();

                    if (confirm) {
                        setDelModalOpen(true);
                        return;
                    }
                    deleteFn();
                }}
                className={`gap-2 p-1 text-sm ${className}`}
            >
                <Icon icon="mdi:trash-can-outline" width={size} height={size} />
                {label && <span>{label}</span>}
            </Button>

            <Modal
                open={delModalOpen && confirm}
                onClose={() => setDelModalOpen(false)}
                className="max-w-md"
            >
                <Modal.Header>Подтвердите удаление</Modal.Header>

                <Modal.Content>
                    <p className="text-sm text-main-300">
                        {labelModal ??
                            "Вы уверены что хотите удалить этот элемент?"}
                    </p>
                </Modal.Content>

                <Modal.Footer>
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
                        onClick={() => {
                            deleteFn();
                            setDelModalOpen(false);
                        }}
                    >
                        Удалить
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};
