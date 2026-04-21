import {
    MessageFeed,
    MessageComposer,
} from "../../../components/organisms/chat";
import { useChat } from "../../../../hooks/useChat";
import { observer } from "mobx-react-lite";
import { workspaceStore } from "../../../../stores/workspaceStore";

export const ChatViewPage = observer(() => {
    const activeDialogId = workspaceStore.activeDialogId;

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
        selectAskQuestion,
        saveAskAnswer,
        sendAskAnswers,
    } = useChat();

    return (
        <>
            <MessageFeed
                key={activeDialogId ?? "no-dialog"}
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
                onSelectAskQuestion={selectAskQuestion}
                onSaveAskAnswer={saveAskAnswer}
                onSendAskAnswers={sendAskAnswers}
            />
            <MessageComposer
                input={input}
                setInput={setInput}
                onSubmit={sendMessage}
                isGenerating={isGenerating}
            />
        </>
    );
});
