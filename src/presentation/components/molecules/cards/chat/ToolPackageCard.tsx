import type { BuiltinToolPackage } from "../../../../../types/Chat";
import { Accordeon } from "../../../atoms";
import { ShikiCodeBlock } from "../../render/ShikiCodeBlock";

type ToolPackageCardProps = {
    pkg: BuiltinToolPackage;
};

export function ToolPackageCard({ pkg }: ToolPackageCardProps) {
    return (
        <article className="rounded-2xl bg-main-900/45 p-4">
            <div className="mb-4">
                <p className="text-base font-semibold text-main-100">
                    {pkg.title}
                </p>
                <p className="mt-1 text-xs text-main-400">{pkg.description}</p>
            </div>

            <div className="space-y-3">
                {pkg.tools.map((tool) => (
                    <Accordeon
                        key={`${pkg.id}_${tool.schema.function.name}`}
                        title={tool.schema.function.name}
                        subtitle={
                            tool.schema.function.description || "Без описания"
                        }
                    >
                        <ShikiCodeBlock
                            language="json"
                            code={JSON.stringify(
                                tool.schema.function.parameters,
                                null,
                                2,
                            )}
                        />
                    </Accordeon>
                ))}
            </div>
        </article>
    );
}
