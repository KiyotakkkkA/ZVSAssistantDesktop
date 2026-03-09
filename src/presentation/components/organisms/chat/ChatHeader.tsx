import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useToasts } from "../../../../hooks";
import { toolsStore } from "../../../../stores/toolsStore";
import { Button, Modal } from "../../atoms";
import { ToolPackageCard } from "../../molecules/cards/chat";
import {
    SettingsView,
    type SettingsViewHandle,
} from "../settings/SettingsView";

type ChatHeaderProps = {
    title?: string;
    onOpenDocuments?: () => void;
};

const scopeToastsMeta = {
    chat: {
        title: "Сохранено!",
        description: "Настройки чата успешно обновлены.",
    },
    profile: {
        title: "Сохранено!",
        description: "Пользовательские данные успешно обновлены.",
    },
    account: {
        title: "Сохранено!",
        description: "Данные ZVS Профильа обновлены.",
    },
};

export function ChatHeader({
    title = "Чат с моделью",
    onOpenDocuments,
}: ChatHeaderProps) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isSettingsSaveVisible, setIsSettingsSaveVisible] = useState(false);
    const settingsViewRef = useRef<SettingsViewHandle | null>(null);
    const toasts = useToasts();

    const handleSaveSettings = async () => {
        let result: Awaited<ReturnType<SettingsViewHandle["save"]>> | undefined;

        try {
            result = await settingsViewRef.current?.save();
        } catch (error) {
            toasts.danger({
                title: "Не удалось сохранить",
                description:
                    error instanceof Error
                        ? error.message
                        : "Произошла ошибка при сохранении настроек.",
            });
            return;
        }

        if (!result) {
            return;
        }

        if (scopeToastsMeta[result.scope as keyof typeof scopeToastsMeta]) {
            toasts.success(
                scopeToastsMeta[result.scope as keyof typeof scopeToastsMeta],
            );
            return;
        }

        toasts.info({
            title: "Изменений нет",
            description: "Здесь нечего сохранять...",
        });
    };

    return (
        <>
            <header className="flex items-center justify-between rounded-2xl bg-main-900/90 px-4 py-3 backdrop-blur-md">
                <div>
                    <h1 className="text-base font-semibold text-main-100">
                        {title}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {onOpenDocuments ? (
                        <Button
                            label="Документы"
                            className="px-3 py-2 text-xs flex gap-2 items-center"
                            onClick={onOpenDocuments}
                        >
                            <Icon
                                icon="mdi:file-document-multiple-outline"
                                width="16"
                                height="16"
                            />
                            Документы
                        </Button>
                    ) : null}
                    <Button
                        label="Память"
                        className="px-3 py-2 text-xs flex gap-2 items-center"
                        disabled
                    >
                        <Icon icon="mdi:brain" width="16" height="16" />
                        Память
                    </Button>
                    <Button label="Search" className="p-2" disabled>
                        <Icon icon="mdi:magnify" width="16" height="16" />
                    </Button>
                    <Button
                        label="Menu"
                        className="p-2"
                        onClick={() => setIsToolsOpen(true)}
                    >
                        <Icon icon="mdi:tools" width="16" height="16" />
                    </Button>
                    <Button
                        label="Settings"
                        className="p-2"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Icon icon="mdi:cog-outline" width="16" height="16" />
                    </Button>
                </div>
            </header>

            <Modal
                closeOnOverlayClick={false}
                open={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                title="Настройки"
                className="h-[90vh] max-w-[min(1440px,98vw)]"
                footer={
                    isSettingsSaveVisible ? (
                        <Button
                            variant="primary"
                            className="rounded-xl px-4 py-2"
                            onClick={() => {
                                void handleSaveSettings();
                            }}
                        >
                            Сохранить
                        </Button>
                    ) : undefined
                }
            >
                <SettingsView
                    ref={settingsViewRef}
                    onSaveVisibilityChange={(isVisible: boolean) => {
                        setIsSettingsSaveVisible(isVisible);
                    }}
                />
            </Modal>

            <Modal
                closeOnOverlayClick={false}
                open={isToolsOpen}
                onClose={() => setIsToolsOpen(false)}
                title="Пакеты инструментов"
                className="max-w-6xl min-h-144"
            >
                <div className="space-y-4">
                    {toolsStore.packages.map((pkg) => (
                        <ToolPackageCard key={pkg.id} pkg={pkg} />
                    ))}
                </div>
            </Modal>
        </>
    );
}
