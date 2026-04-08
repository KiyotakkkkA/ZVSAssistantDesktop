import type { MouseEvent } from "react";
import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { Icon } from "@iconify/react";
import type { ProviderConfig } from "../../../../../../../electron/models/user";

type SettingsSearchapiWebProviderFieldProps = {
    providerConfig: ProviderConfig;
    onChange: (nextConfig: ProviderConfig) => void;
};

export function SettingsSearchapiWebProviderField({
    providerConfig,
    onChange,
}: SettingsSearchapiWebProviderFieldProps) {
    const handleOpenExternal = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        void window.core.openExternal(event.currentTarget.href);
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-main-200">Token</p>
            <div className="flex items-center gap-2 w-full">
                <div className="flex-1">
                    <InputSmall
                        value={providerConfig.apiKey}
                        onChange={(event) =>
                            onChange({
                                ...providerConfig,
                                apiKey: event.target.value,
                            })
                        }
                        placeholder="Token"
                        type="password"
                    />
                </div>
                <a
                    href="https://www.searchapi.io/api_tokens"
                    onClick={handleOpenExternal}
                    rel="noreferrer"
                    className="rounded-md p-2 text-white transition-all duration-200 flex items-center gap-1 text-xs bg-indigo-700 hover:bg-indigo-800 hover:-translate-y-0.5"
                >
                    <Icon icon="mdi:open-in-new" width={18} height={18} />
                    Получить ключ
                </a>
            </div>
        </div>
    );
}
