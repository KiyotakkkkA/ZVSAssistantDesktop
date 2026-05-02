import { useMemo } from "react";
import { Icon } from "@iconify/react";
import { Dropdown } from "@kiyotakkkka/zvs-uikit-lib/ui";

export type ProviderSelectorOption = {
    value: string;
    label: string;
    logoIcon: string;
    logoClassName?: string;
};

type ProviderSelectorProps = {
    options: ProviderSelectorOption[];
    value: string;
    onChange: (nextValue: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
};

export function ProviderSelector({
    options,
    value,
    onChange,
    placeholder = "Выберите провайдера",
    className,
    disabled = false,
}: ProviderSelectorProps) {
    const selectedOption = useMemo(
        () => options.find((item) => item.value === value),
        [options, value],
    );

    const dropdownOptions = useMemo(
        () =>
            options.map((item) => ({
                value: item.value,
                label: item.label,
                icon: (
                    <span
                        className={`inline-flex items-center justify-center rounded-md bg-main-700/75 p-1 ${item.logoClassName ?? "text-main-100"}`}
                    >
                        <Icon icon={item.logoIcon} width={14} height={14} />
                    </span>
                ),
                onClick: () => {
                    onChange(item.value);
                },
            })),
        [onChange, options],
    );

    return (
        <Dropdown
            disabled={disabled}
            menuPlacement="bottom"
            menuWidth="max-content"
            menuRole="listbox"
            className={className}
        >
            <Dropdown.Trigger
                className={`relative flex w-full items-center justify-between gap-3 rounded-xl border border-main-700/80 bg-main-800/65 px-3 py-2.5 text-left transition-colors hover:bg-main-700/70 ${className ?? ""} cursor-pointer`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span
                        className={`inline-flex items-center justify-center rounded-md bg-main-700/75 p-1 ${selectedOption?.logoClassName ?? "text-main-100"}`}
                    >
                        <Icon
                            icon={selectedOption?.logoIcon ?? "mdi:connection"}
                            width={16}
                            height={16}
                        />
                    </span>

                    <span className="truncate text-sm text-main-100">
                        {selectedOption?.label ?? placeholder}
                    </span>
                </span>
            </Dropdown.Trigger>

            <Dropdown.Menu className="border border-main-700/80 bg-main-900 shadow-xl space-y-2">
                {dropdownOptions.map((option) => (
                    <Dropdown.Item
                        key={option.value}
                        onClick={option.onClick}
                        active={option.value === value}
                        className="rounded-lg px-3 py-2 text-sm hover:bg-main-700/70"
                    >
                        <span className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                        </span>
                    </Dropdown.Item>
                ))}
            </Dropdown.Menu>
        </Dropdown>
    );
}
