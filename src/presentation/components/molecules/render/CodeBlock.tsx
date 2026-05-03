import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../../../../data/MsgToasts";
import { Button, CodeView } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { Icon } from "@iconify/react";

interface CodeBlockProps {
    code: string;
    language?: string;
}

const downloadTextFile = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export const CodeBlock = ({ code, language }: CodeBlockProps) => {
    const toast = useToasts();
    const normalizedLanguage = language?.toLowerCase() || "plaintext";

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success(MsgToasts.COPY_SUCCESS());
        } catch {
            // noop
        }
    };

    const buildDownloadFilename = () => {
        const fileId =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        return `${fileId}.${normalizedLanguage}`;
    };

    const handleDownload = () => {
        downloadTextFile(code, buildDownloadFilename());
    };

    return (
        <CodeView
            code={code}
            language={normalizedLanguage}
            theme="monokai"
            defaultActions={false}
        >
            <CodeView.Header
                actions={
                    <div className="flex gap-4">
                        <Button
                            variant="ghost"
                            shape="rounded-md"
                            className="text-xs gap-2 hover:bg-main-800 p-1 text-main-400/90 "
                            onClick={handleDownload}
                        >
                            <Icon icon="mdi:download" width={18} height={18} />
                            Скачать
                        </Button>
                        <Button
                            variant="ghost"
                            shape="rounded-md"
                            className="text-xs gap-2 hover:bg-main-800 p-1 text-main-400/90 "
                            onClick={copyCode}
                        >
                            <Icon icon="mdi:files" width={18} height={18} />
                            Скопировать
                        </Button>
                    </div>
                }
            />
            <CodeView.Content />
        </CodeView>
    );
};
