import {
    MessageFeed,
    MessageComposer,
} from "../../../components/organisms/chat";

export const ChatViewPage = () => {
    return (
        <div className="max-h-full flex h-full flex-col">
            <MessageFeed />
            <MessageComposer />
        </div>
    );
};
