import {
    MessageFeed,
    MessageComposer,
} from "../../../components/organisms/chat";
import { useChat } from "../../../../hooks/useChat";
import { Header } from "../../../layouts/Header";
import { observer } from "mobx-react-lite";

export const ChatViewPage = observer(() => {
    const {
        messages,
        input,
        setInput,
        sendMessage,
        isGenerating,
        editingMessageId,
        editingValue,
        setEditingValue,
        startEditMessage,
        cancelEditMessage,
        confirmEditMessage,
        copyMessage,
        refreshMessage,
        deleteMessage,
    } = useChat();

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-y-2">
            <Header />

            <div className="max-h-full flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <MessageFeed
                    messages={messages}
                    editingMessageId={editingMessageId}
                    editingValue={editingValue}
                    onEditValueChange={setEditingValue}
                    onStartEdit={startEditMessage}
                    onCancelEdit={cancelEditMessage}
                    onConfirmEdit={confirmEditMessage}
                    onCopyMessage={copyMessage}
                    onRefreshMessage={refreshMessage}
                    onDeleteMessage={deleteMessage}
                />
                <MessageComposer
                    input={input}
                    setInput={setInput}
                    onSubmit={sendMessage}
                    isGenerating={isGenerating}
                />
            </div>
        </div>
    );
});
