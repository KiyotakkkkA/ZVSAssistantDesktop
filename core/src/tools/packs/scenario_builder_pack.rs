use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    enum_string_schema, object_schema, package_tool_with_output, string_schema,
    BuiltinToolPackage,
};

pub fn build_scenario_builder_pack() -> BuiltinToolPackage {
    let mut props = BTreeMap::new();
    props.insert(
        "action".to_owned(),
        enum_string_schema(
            "Действие над текущей схемой",
            &[
                "get_state",
                "create_block",
                "update_block",
                "delete_block",
                "create_connection",
                "delete_connection",
                "set_viewport",
                "apply_batch",
            ],
        ),
    );
    props.insert("scenarioId".to_owned(), string_schema("ID сценария (опционально)"));
    props.insert("block".to_owned(), string_schema("JSON блока для create/update"));
    props.insert("blockId".to_owned(), string_schema("ID блока"));
    props.insert(
        "connection".to_owned(),
        string_schema("JSON соединения для create_connection"),
    );
    props.insert("connectionId".to_owned(), string_schema("ID соединения"));
    props.insert(
        "viewport".to_owned(),
        string_schema("JSON viewport с partial-обновлением"),
    );
    props.insert(
        "operations".to_owned(),
        string_schema("JSON-массив операций для apply_batch. Каждый элемент повторяет обычный вызов: {action, block?, blockId?, connection?, connectionId?, viewport?}. Для нескольких изменений рекомендуется один apply_batch вместо серии вызовов."),
    );

    BuiltinToolPackage {
        id: "scenario-builder-tools".to_owned(),
        title: "Scenario Builder".to_owned(),
        description: "Инструменты управления блоками, связями и viewport текущей схемы"
            .to_owned(),
        tools: vec![
            package_tool_with_output(
                "scenario-builder-tools",
                "Scenario Builder",
                "Инструменты управления блоками, связями и viewport текущей схемы",
                "scenario_builder_tool",
                "Полный контроль над схемой. Общий вход: action:string. Поддерживаемые действия и входы: get_state (опц. scenarioId); create_block (scenarioId?, block JSON-строка без id: kind/title/x/y/width/height/meta); update_block (scenarioId?, blockId, block JSON-строка патча); delete_block (scenarioId?, blockId); create_connection (scenarioId?, connection JSON-строка с fromBlockId/toBlockId/fromPortName?/toPortName?; id генерируется на исполнении); delete_connection (scenarioId?, connectionId); set_viewport (scenarioId?, viewport JSON-строка с scale/offsetX/offsetY); apply_batch (scenarioId?, operations JSON-массив тех же действий). Ограничение: create_block не должен создавать kind=start/end. Рекомендация: если нужно сделать несколько изменений подряд, используй один apply_batch. Общий выход: ok:boolean, action:string, scenarioId:string, message:string; get_state возвращает scene{blocks,connections,viewport}; мутации возвращают только компактный результат (block/connection/viewport + counts) без полной scene; apply_batch возвращает applied[]. При ошибке возвращает error:string.",
                object_schema(props, &["action"]),
                json!({
                    "type": "object",
                    "properties": {
                        "ok": { "type": "boolean" },
                        "action": { "type": "string" },
                        "scenarioId": { "type": "string" },
                        "scene": { "type": "object" },
                        "block": { "type": "object" },
                        "connection": { "type": "object" },
                        "viewport": { "type": "object" },
                        "applied": { "type": "array", "items": { "type": "object" } },
                        "blocksCount": { "type": "number" },
                        "connectionsCount": { "type": "number" },
                        "message": { "type": "string" },
                        "error": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "scenario-builder-tools",
                "Scenario Builder",
                "Инструменты управления блоками, связями и viewport текущей схемы",
                "get_components",
                "Возвращает все доступные компоненты для построения сценария. Для каждого элемента включает kind, blockType, title, description, input, output и canCreate. Для tool-блоков дополнительно возвращает toolType(=title), пакет инструмента, input schema и output schema.",
                object_schema(BTreeMap::new(), &[]),
                json!({
                    "type": "object",
                    "properties": {
                        "ok": { "type": "boolean" },
                        "components": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "kind": { "type": "string" },
                                    "blockType": { "type": "string" },
                                    "title": { "type": "string" },
                                    "description": { "type": "string" },
                                    "canCreate": { "type": "boolean" },
                                    "input": { "type": "object" },
                                    "output": { "type": "object" }
                                }
                            }
                        }
                    }
                }),
            ),
        ],
    }
}
