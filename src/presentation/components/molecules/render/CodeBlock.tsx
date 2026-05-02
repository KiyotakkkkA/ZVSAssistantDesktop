import { useToasts } from "@kiyotakkkka/zvs-uikit-lib/hooks";
import { MsgToasts } from "../../../../data/MsgToasts";
import { CodeView } from "@kiyotakkkka/zvs-uikit-lib/ui";

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
            onCopy={copyCode}
            onDownload={handleDownload}
        />
    );
};
