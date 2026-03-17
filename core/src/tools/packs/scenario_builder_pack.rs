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

    BuiltinToolPackage {
        id: "scenario-builder-tools".to_owned(),
        title: "Scenario Builder".to_owned(),
        description: "Инструменты управления блоками, связями и viewport текущей схемы"
            .to_owned(),
        tools: vec![package_tool_with_output(
            "scenario-builder-tools",
            "Scenario Builder",
            "Инструменты управления блоками, связями и viewport текущей схемы",
            "scenario_builder_tool",
            "Полный контроль над схемой. Общий вход: action:string. Поддерживаемые действия и входы: get_state (опц. scenarioId); create_block (scenarioId?, block JSON-строка с id/type/position/meta); update_block (scenarioId?, blockId, block JSON-строка патча); delete_block (scenarioId?, blockId); create_connection (scenarioId?, connection JSON-строка с source/target/sourceOutput?/targetInput?); delete_connection (scenarioId?, connectionId); set_viewport (scenarioId?, viewport JSON-строка с scale/offsetX/offsetY). Общий выход: ok:boolean, action:string, scenarioId:string, message:string; при get_state возвращает scene{blocks,connections,viewport}; при create/update/delete_block возвращает block; при create/delete_connection возвращает connection; при ошибке возвращает error:string.",
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
                    "message": { "type": "string" },
                    "error": { "type": "string" }
                }
            }),
        )],
    }
}
