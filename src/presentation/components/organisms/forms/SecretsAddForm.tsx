import { Button, InputSmall, Separator } from "@kiyotakkkka/zvs-uikit-lib/ui";
import { Icon } from "@iconify/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { secretsStore } from "../../../../stores/secretsStore";

type SecretsAddFormProps = {
    onCancel: () => void;
    onSuccess?: () => void;
};

const secretTypeOptions = [
    {
        value: "github",
        label: "GitHub",
        icon: "simple-icons:github",
    },
    {
        value: "gitlab",
        label: "GitLab",
        icon: "simple-icons:gitlab",
    },
    {
        value: "ollama",
        label: "Ollama",
        icon: "simple-icons:ollama",
    },
    {
        value: "searchapi",
        label: "SearchAPI",
        icon: "mdi:key",
    },
];

export const SecretsAddForm = ({
    onCancel,
    onSuccess,
}: SecretsAddFormProps) => {
    const [type, setType] = useState(secretTypeOptions[0].value);
    const [name, setName] = useState("");
    const [secret, setSecret] = useState("");

    const isSubmitDisabled = !name.trim() || !secret.trim();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSubmitDisabled) {
            return;
        }

        await secretsStore.addSecret({
            type,
            name: name.trim(),
            secret: secret.trim(),
        });

        setName("");
        setSecret("");
        setType(secretTypeOptions[0].value);
        onSuccess?.();
    };

    return (
        <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
                <label className="block text-base font-semibold text-main-100">
                    Тип секрета
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {secretTypeOptions.map((option) => {
                        const isActive = type === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setType(option.value)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-pointer ${
                                    isActive
                                        ? "border-main-400 bg-main-700/60 text-main-100"
                                        : "border-main-700/70 bg-main-800/40 text-main-300 hover:border-main-500 hover:text-main-100"
                                }`}
                            >
                                <Icon
                                    icon={option.icon}
                                    width={16}
                                    height={16}
                                />
                                <span>{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <Separator className="border-main-700/70" />

            <div className="space-y-2">
                <label className="block text-base font-semibold text-main-100">
                    Название секрета
                </label>
                <InputSmall
                    placeholder="Например, OpenAI API Key"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
            </div>

            <div className="space-y-2">
                <label className="block text-base font-semibold text-main-100">
                    Значение секрета
                </label>
                <InputSmall
                    type="password"
                    placeholder="Введите секрет"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                />
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <Button
                    type="button"
                    variant="secondary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    onClick={onCancel}
                >
                    Отмена
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    shape="rounded-lg"
                    className="h-9 px-4"
                    disabled={isSubmitDisabled}
                >
                    Добавить
                </Button>
            </div>
        </form>
    );
};
