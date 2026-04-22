import { Icon } from "@iconify/react";
import { Button } from "@kiyotakkkka/zvs-uikit-lib/ui";

interface ButtonCreateProps {
    label?: string;
    size?: number;
    className?: string;
    disabled?: boolean;
    createFn: () => void;
}

export const ButtonCreate = ({
    label,
    size = 22,
    disabled,
    className,
    createFn,
}: ButtonCreateProps) => {
    return (
        <Button
            variant="primary"
            shape="rounded-md"
            disabled={disabled}
            onClick={createFn}
            className={`gap-2 p-1 text-sm ${className}`}
        >
            <Icon icon="mdi:plus-circle-outline" width={size} height={size} />
            {label && <span>{label}</span>}
        </Button>
    );
};
