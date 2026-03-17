use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    confirmation_spec, object_schema, package_tool_with_output, string_schema,
    with_confirmation, BuiltinToolPackage,
};

pub fn build_terminal_pack() -> BuiltinToolPackage {
    let mut command_exec_props = BTreeMap::new();
    command_exec_props.insert("command".to_owned(), string_schema("Shell-команда для выполнения"));
    command_exec_props.insert(
        "cwd".to_owned(),
        string_schema("Рабочая директория выполнения (опционально)"),
    );

    BuiltinToolPackage {
        id: "terminal-tools".to_owned(),
        title: "Работа с терминалом".to_owned(),
        description: "Инструменты для безопасного выполнения команд".to_owned(),
        tools: vec![with_confirmation(
            package_tool_with_output(
                "terminal-tools",
                "Работа с терминалом",
                "Инструменты для безопасного выполнения команд",
                "command_exec",
                "Назначение: выполнить shell-команду в рабочей директории. Вход: command:string (обязательный), cwd:string (опционально). Выход: command, cwd, isAdmin:boolean, exitCode:number, stdout:string, stderr:string; при ошибке может вернуть поле error/message. Инструмент требует подтверждение, если авто-подтверждение не включено.",
                object_schema(command_exec_props, &["command"]),
                json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" },
                        "cwd": { "type": "string" },
                        "isAdmin": { "type": "boolean" },
                        "exitCode": { "type": "number" },
                        "stdout": { "type": "string" },
                        "stderr": { "type": "string" }
                    }
                }),
            ),
            confirmation_spec(
                "Подтверждение выполнения команды",
                "Проверь shell-команду и рабочую директорию перед запуском.",
            ),
        )],
    }
}
