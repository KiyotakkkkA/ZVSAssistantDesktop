import { Icon } from "@iconify/react";
import { Button, InputSmall, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useMemo, useState } from "react";

type IconPickerProps = {
    value: string;
    onChange: (icon: string) => void;
    label?: string;
};

const iconOptions = [
    "mdi:robot-outline",
    "mdi:robot-happy-outline",
    "mdi:account-tie-outline",
    "mdi:account-cog-outline",
    "mdi:account-search-outline",
    "mdi:head-lightbulb-outline",
    "mdi:brain",
    "mdi:creation-outline",
    "mdi:auto-fix",
    "mdi:magic-staff",
    "mdi:code-braces",
    "mdi:code-tags",
    "mdi:console",
    "mdi:git",
    "mdi:source-branch",
    "mdi:bug-outline",
    "mdi:test-tube",
    "mdi:database-outline",
    "mdi:server-network",
    "mdi:cloud-outline",
    "mdi:api",
    "mdi:web",
    "mdi:earth",
    "mdi:magnify",
    "mdi:file-search-outline",
    "mdi:file-document-outline",
    "mdi:file-tree-outline",
    "mdi:folder-search-outline",
    "mdi:book-open-page-variant-outline",
    "mdi:clipboard-text-search-outline",
    "mdi:chart-line",
    "mdi:chart-timeline-variant",
    "mdi:chart-box-outline",
    "mdi:finance",
    "mdi:calculator-variant-outline",
    "mdi:calendar-check-outline",
    "mdi:clock-outline",
    "mdi:timer-cog-outline",
    "mdi:bell-outline",
    "mdi:message-text-outline",
    "mdi:email-outline",
    "mdi:forum-outline",
    "mdi:phone-outline",
    "mdi:translate",
    "mdi:pencil-outline",
    "mdi:draw",
    "mdi:image-edit-outline",
    "mdi:palette-outline",
    "mdi:music-note-outline",
    "mdi:video-outline",
    "mdi:shield-check-outline",
    "mdi:lock-check-outline",
    "mdi:key-outline",
    "mdi:briefcase-outline",
    "mdi:rocket-launch-outline",
    "mdi:target",
    "mdi:compass-outline",
    "mdi:map-search-outline",
    "mdi:hammer-wrench",
    "mdi:tools",
    "mdi:toolbox-outline",
    "mdi:cog-outline",
    "mdi:tune-variant",
    "mdi:vector-link",
    "mdi:graph-outline",
    "mdi:hubspot",
    "mdi:lightning-bolt-outline",
    "mdi:flash-outline",
    "mdi:format-list-checks",
    "mdi:playlist-check",
    "mdi:timeline-text-outline",
    "mdi:sitemap-outline",
    "mdi:layers-outline",
    "mdi:cube-outline",
    "mdi:package-variant-closed",
    "mdi:flask-outline",
    "mdi:school-outline",
    "mdi:medical-bag",
    "mdi:gavel",
    "mdi:home-analytics",
    "mdi:cart-outline",
    "mdi:truck-delivery-outline",
    "mdi:cash-multiple",
    "mdi:handshake-outline",
    "mdi:checkbox-marked-circle-outline",
    "mdi:alert-circle-outline",
    "mdi:information-outline",
];

export const IconPicker = ({ value, onChange, label = "Иконка" }: IconPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");

    const filteredIcons = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return iconOptions;
        }

        return iconOptions.filter((icon) =>
            icon.toLowerCase().includes(normalizedQuery),
        );
    }, [query]);

    const handleSelect = (icon: string) => {
        onChange(icon);
        setIsOpen(false);
    };

    return (
        <section className="rounded-2xl border border-main-700/60 bg-main-900/40 p-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-base text-main-100">{label}</h2>
                <Button
                    type="button"
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-8 px-3 text-xs"
                    onClick={() => setIsOpen(true)}
                >
                    Выбрать
                </Button>
            </div>

            <button
                type="button"
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-main-700/70 bg-main-900/55 p-3 text-left transition-colors hover:border-main-500"
                onClick={() => setIsOpen(true)}
            >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-main-600/80 bg-main-800/80 text-main-100">
                    <Icon icon={value} width={24} height={24} />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm text-main-100">
                        Текущая иконка
                    </span>
                    <span className="block truncate text-xs text-main-400">
                        {value}
                    </span>
                </span>
            </button>

            <Modal
                open={isOpen}
                onClose={() => setIsOpen(false)}
                className="max-w-4xl"
            >
                <Modal.Header className="text-main-100">
                    Выбор иконки
                </Modal.Header>

                <Modal.Content>
                    <div className="space-y-3">
                        <InputSmall
                            value={query}
                            placeholder="Поиск по названию иконки"
                            onChange={(event) => setQuery(event.target.value)}
                        />

                        <div className="grid max-h-[28rem] grid-cols-8 gap-2 overflow-y-auto rounded-2xl border border-main-700/60 bg-main-950/20 p-3">
                            {filteredIcons.map((icon) => {
                                const isSelected = icon === value;

                                return (
                                    <button
                                        key={icon}
                                        type="button"
                                        title={icon}
                                        className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                                            isSelected
                                                ? "border-main-400 bg-main-700/80 text-main-100"
                                                : "border-main-700/60 bg-main-900/60 text-main-300 hover:border-main-500 hover:text-main-100"
                                        }`}
                                        onClick={() => handleSelect(icon)}
                                    >
                                        <Icon
                                            icon={icon}
                                            width={22}
                                            height={22}
                                        />
                                    </button>
                                );
                            })}
                        </div>

                        {filteredIcons.length === 0 ? (
                            <p className="rounded-xl bg-main-900/45 p-3 text-sm text-main-400">
                                Иконки по запросу не найдены.
                            </p>
                        ) : null}
                    </div>
                </Modal.Content>
            </Modal>
        </section>
    );
};
