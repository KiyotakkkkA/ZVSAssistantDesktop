import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useToasts } from "../../../../hooks";
import { useScenario } from "../../../../hooks/agents";
import { Button, InputBig, InputSmall } from "../../../components/atoms";

export const CreateScenarioPage = observer(function CreateScenarioPage() {
    const navigate = useNavigate();
    const toasts = useToasts();
    const { createScenario } = useScenario();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const submit = async () => {
        const trimmedName = name.trim();

        if (!trimmedName) {
            toasts.warning({
                title: "Введите название",
                description: "Название сценария не может быть пустым.",
            });
            return;
        }

        if (isCreating) {
            return;
        }

        setIsCreating(true);

        try {
            const scenario = await createScenario({
                name: trimmedName,
                description: description.trim(),
            });

            if (!scenario) {
                toasts.danger({
                    title: "Ошибка создания",
                    description: "Не удалось создать сценарий.",
                });
                return;
            }

            toasts.success({
                title: "Сценарий создан",
                description: "Сценарий добавлен в рабочую область.",
            });

            navigate(`/workspace/scenario/${scenario.id}`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <section className="animate-page-fade-in flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-main-900/70 p-4 backdrop-blur-md">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-main-900/60">
                <div className="flex-1 space-y-6 overflow-y-auto p-1">
                    <div>
                        <h2 className="text-lg font-semibold text-main-100">
                            Создание сценария
                        </h2>
                        <p className="mt-2 text-sm text-main-300">
                            Укажите базовые данные сценария.
                        </p>
                    </div>

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <p className="text-sm font-semibold text-main-100">
                            Название сценария
                        </p>
                        <InputSmall
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Название сценария"
                        />
                    </section>

                    <section className="space-y-2 border-l-3 border-main-600 pl-3">
                        <p className="text-sm font-semibold text-main-100">
                            Описание сценария
                        </p>
                        <InputBig
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            className="h-28! rounded-xl! border border-main-700/70 bg-main-800/70 px-3 py-2 text-main-100 placeholder:text-main-500"
                            placeholder="Опишите цель и контекст сценария"
                        />
                    </section>
                </div>

                <div className="p-4">
                    <Button
                        variant="primary"
                        shape="rounded-lg"
                        className="h-9 px-4"
                        disabled={isCreating}
                        onClick={() => {
                            void submit();
                        }}
                    >
                        {isCreating ? "Создание..." : "Создать сценарий"}
                    </Button>
                </div>
            </div>
        </section>
    );
});
