import { SecretsDataTable } from "../../components/organisms/secrets";

export const SecretsManagerPage = () => {
    return (
        <div className="flex-col h-full w-full rounded-3xl bg-main-800/70 animate-page-fade-in">
            <div className="border-b border-main-600/55 w-full h-fit p-4">
                <h1 className="text-xl mb-3">Менеджер секретов</h1>
            </div>
            <div className="p-4">
                <SecretsDataTable />
            </div>
        </div>
    );
};
