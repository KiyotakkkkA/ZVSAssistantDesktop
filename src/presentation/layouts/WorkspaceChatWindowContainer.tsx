import { Icon } from "@iconify/react";
import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { useCallback, useRef, useState } from "react";
import {
    SettingsView,
    type SettingsViewHandle,
} from "../components/organisms/settings/SettingsView";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { profileStore } from "../../stores/profileStore";

const routerTable = {
    "/workspace/chat/view": {
        redirectTo: "/workspace/chat/json",
        icon: "mdi:code",
    },
    "/workspace/chat/json": {
        redirectTo: "/workspace/chat/view",
        icon: "mdi:message-text-outline",
    },
};

export const WorkspaceChatWindowContainer = observer(() => {
    const currentUser = profileStore.user;
    const generalData = currentUser?.generalData;

    const location = useLocation();
    const navigate = useNavigate();

    const settingsViewRef = useRef<SettingsViewHandle | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSettingsSaveVisible, setIsSettingsSaveVisible] = useState(false);

    const handleSaveVisibilityChange = useCallback((isVisible: boolean) => {
        setIsSettingsSaveVisible((current) =>
            current === isVisible ? current : isVisible,
        );
    }, []);

    const handleSaveSettings = async () => {
        await settingsViewRef.current?.save();
    };

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-y-2">
            <header className="flex items-center gap-3 justify-end animate-card-rise-in pl-2">
                {generalData?.isExtendedInterfaceModeEnabled && (
                    <Button
                        variant="secondary"
                        className="p-1.5 gap-2 text-sm"
                        onClick={() => {
                            navigate(
                                routerTable[
                                    location.pathname as keyof typeof routerTable
                                ]?.redirectTo || "/workspace/chat/view",
                            );
                        }}
                    >
                        <Icon
                            icon={
                                routerTable[
                                    location.pathname as keyof typeof routerTable
                                ]?.icon || "mdi:help-circle-outline"
                            }
                            width={22}
                        />
                    </Button>
                )}
                <Button
                    variant="primary"
                    className="p-1.5 border-transparent"
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
                className="h-[90vh] max-w-[min(1440px,98vw)]"
            >
                <Modal.Header>Настройки</Modal.Header>

                <Modal.Content>
                    <SettingsView
                        ref={settingsViewRef}
                        onSaveVisibilityChange={handleSaveVisibilityChange}
                    />
                </Modal.Content>

                {isSettingsSaveVisible && (
                    <Modal.Footer>
                        <Button
                            variant="primary"
                            className="rounded-xl px-4 py-2"
                            onClick={() => {
                                void handleSaveSettings();
                            }}
                        >
                            Сохранить
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
            <div className="max-h-full flex h-full min-h-0 flex-1 flex-col overflow-hidden ">
                <Outlet />
            </div>
        </div>
    );
});
