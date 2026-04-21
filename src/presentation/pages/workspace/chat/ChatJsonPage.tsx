import { observer } from "mobx-react-lite";
import { workspaceStore } from "../../../../stores/workspaceStore";
import { ShikiCodeBlock } from "../../../components/molecules/render";
import { Separator } from "@kiyotakkkka/zvs-uikit-lib/ui";

const safeJson = (value: unknown) => {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return String(value ?? "{}");
    }
};

export const ChatJsonPage = observer(() => {
    const activeDialogId = workspaceStore.activeDialogId;
    const dialogContext = workspaceStore.contextMessages;
    const dialogContextJson = safeJson({
        dialog_id: activeDialogId,
        dialog_context: dialogContext,
    });

    return (
        <div className="flex h-full min-h-0 animate-page-fade-in justify-center">
            <div className="min-h-0 overflow-auto rounded-xl max-w-3/4  ">
                <ShikiCodeBlock code={dialogContextJson} language="json" />
                <Separator className="my-4" />
            </div>
        </div>
    );
});
