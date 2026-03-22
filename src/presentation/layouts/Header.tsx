import { Icon } from "@iconify/react";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { useRef, useState } from "react";
import {
    SettingsView,
    type SettingsViewHandle,
} from "../components/organisms/settings/SettingsView";

export const Header = () => {
    const settingsViewRef = useRef<SettingsViewHandle | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSettingsSaveVisible, setIsSettingsSaveVisible] = useState(false);

    const handleSaveSettings = async () => {
        await settingsViewRef.current?.save();
    };

    return (
        <>
            <header className="flex items-center gap-3 justify-end animate-card-rise-in">
                <Button
                    variant="secondary"
                    className="p-1.5 border-transparent transition-transform duration-200 hover:scale-105 active:scale-95"
                    onClick={() => {
                        setIsSettingsOpen(true);
                    }}
                >
                    <Icon icon="mdi:cog-outline" width={22} />
                </Button>
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
        </>
    );
};
