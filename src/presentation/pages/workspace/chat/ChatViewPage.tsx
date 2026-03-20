import {
    MessageFeed,
    MessageComposer,
} from "../../../components/organisms/chat";
import { useChat } from "../../../../hooks/useChat";

export const ChatViewPage = () => {
    const { messages, input, setInput, sendMessage, isGenerating } = useChat();

    return (
        <div className="max-h-full flex h-full min-h-0 flex-col overflow-hidden">
            <MessageFeed messages={messages} />
            <MessageComposer
                input={input}
                setInput={setInput}
                onSubmit={sendMessage}
                isGenerating={isGenerating}
            />
        </div>
    );
};
