import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useChat } from "../../../hooks/agents";
import { useDialogs, useProjects } from "../../../hooks";
import { chatsStore } from "../../../stores/chatsStore";
import { MessageComposer } from "../../components/molecules";
import { ChatHeader, MessageFeed } from "../../components/organisms/chat";
import { Icon } from "@iconify/react";
import { LoadingFallbackPage } from "../LoadingFallbackPage";

const NoMessagesPlaceholder = () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-main-300">
        <Icon icon="mdi:message-text-outline" width={48} height={48} />
        <p className="text-sm">
            Диалог пуст... Начните общение, написав сообщение в поле снизу.
        </p>
    </div>
);

export const ChatPage = observer(function ChatPage() {
    const { clearActiveProject } = useProjects();
    const { isSwitchingDialog } = useDialogs();
    const {
        messages,
        sendMessage,
        cancelGeneration,
        isStreaming,
        isAwaitingFirstChunk,
        activeStage,
        activeResponseToId,
    } = useChat();

    useEffect(() => {
        if (!chatsStore.activeDialog) {
            return;
        }

        if (chatsStore.activeDialog.forProjectId === null) {
            clearActiveProject();
        }
    }, [clearActiveProject]);

    if (isSwitchingDialog) {
        return <LoadingFallbackPage title="Загрузка диалога..." />;
    }

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 backdrop-blur-md">
            <ChatHeader />
            {messages.length === 0 && !isAwaitingFirstChunk ? (
                <NoMessagesPlaceholder />
            ) : (
                <MessageFeed
                    messages={messages}
                    sendMessage={sendMessage}
                    showLoader={isAwaitingFirstChunk}
                    activeStage={activeStage}
                    activeResponseToId={activeResponseToId}
                    contextKey={chatsStore.activeDialog?.id}
                />
            )}
            <MessageComposer
                onMessageSend={sendMessage}
                onCancelGeneration={cancelGeneration}
                isStreaming={isStreaming}
            />
        </section>
    );
});
