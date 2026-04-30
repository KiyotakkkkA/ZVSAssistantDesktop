import { Icon } from "@iconify/react";
import { InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib/ui";

interface InputCheckSlidedProps {
    checked: boolean;
    icon: string;
    isize?: number;
    label: string;
    description?: string;
    onChange: (checked: boolean) => void;
}

export const SettingsColoredCheckboxRow = ({
    checked,
    label,
    icon,
    isize = 28,
    description,
    onChange,
}: InputCheckSlidedProps) => {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 items-center">
                <Icon
                    icon={icon}
                    width={isize}
                    height={isize}
                    className={`text-main-300 rounded-md p-0.5 ${checked ? "bg-lime-700/80" : "bg-main-700/80"}`}
                />
                <div>
                    <p className="text-sm font-medium text-main-200">{label}</p>
                    {description && (
                        <p className="text-xs text-main-400">{description}</p>
                    )}
                </div>
            </div>

            <InputCheckSlided checked={checked} onChange={onChange} />
        </div>
    );
};
