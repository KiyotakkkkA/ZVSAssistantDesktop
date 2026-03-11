use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    array_of_objects_schema, array_of_strings_schema, enum_string_schema,
    number_schema, object_schema, package_tool_with_output, string_schema,
    BuiltinToolPackage,
};

pub fn build_base_pack() -> BuiltinToolPackage {
    let mut qa_question_props = BTreeMap::new();
    qa_question_props.insert(
        "question".to_owned(),
        string_schema("Короткий точный вопрос пользователю. Один вопрос = один недостающий факт."),
    );
    qa_question_props.insert(
        "reason".to_owned(),
        string_schema("Короткое объяснение, зачем нужен именно этот ответ."),
    );
    qa_question_props.insert(
        "selectAnswers".to_owned(),
        array_of_strings_schema("Список из 3-6 коротких готовых вариантов ответа для быстрого выбора, если вопрос допускает типовые варианты."),
    );
    qa_question_props.insert(
        "userAnswerHint".to_owned(),
        string_schema("Подсказка, какой краткий ответ ожидается от пользователя."),
    );

    let mut qa_props = BTreeMap::new();
    qa_props.insert(
        "questions".to_owned(),
        array_of_objects_schema(
            "Список из 1-3 коротких точных вопросов. Каждый вопрос должен быть самостоятельным, без длинных вступлений и без объединения несвязанных тем.",
            qa_question_props,
            &["question"],
        ),
    );

    let mut planning_props = BTreeMap::new();
    planning_props.insert(
        "action".to_owned(),
        enum_string_schema(
            "Действие планировщика",
            &["create", "complete_step", "get_status"],
        ),
    );
    planning_props.insert("title".to_owned(), string_schema("Название плана"));
    planning_props.insert("steps".to_owned(), array_of_strings_schema("Шаги плана"));
    planning_props.insert("plan_id".to_owned(), string_schema("ID плана"));
    planning_props.insert("step_id".to_owned(), number_schema("Номер шага"));

    let mut command_exec_props = BTreeMap::new();
    command_exec_props.insert("command".to_owned(), string_schema("Shell-команда для выполнения"));
    command_exec_props.insert(
        "cwd".to_owned(),
        string_schema("Рабочая директория выполнения (опционально)"),
    );

    let mut vector_search_props = BTreeMap::new();
    vector_search_props.insert("query".to_owned(), string_schema("Поисковый запрос"));
    vector_search_props.insert("limit".to_owned(), number_schema("Лимит результатов 1..10"));

    BuiltinToolPackage {
        id: "base-tools".to_owned(),
        title: "Базовые инструменты".to_owned(),
        description: "Набор базовых инструментов для взаимодействия модели с внешней средой"
            .to_owned(),
        tools: vec![
            package_tool_with_output(
                "base-tools",
                "Базовые инструменты",
                "Набор базовых инструментов для взаимодействия модели с внешней средой",
                "qa_tool",
                "Запрашивает у пользователя до 3 коротких и точных уточнений в одном вызове. Каждый вопрос должен спрашивать только один недостающий факт. Для категориальных вопросов добавляй selectAnswers для быстрого выбора.",
                object_schema(qa_props, &["questions"]),
                json!({
                    "type": "object",
                    "properties": {
                        "status": { "type": "string" },
                        "questions": { "type": "array", "items": { "type": "object" } },
                        "instruction": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "base-tools",
                "Базовые инструменты",
                "Набор базовых инструментов для взаимодействия модели с внешней средой",
                "planning_tool",
                "Управляет планом выполнения задачи",
                object_schema(planning_props, &["action"]),
                json!({
                    "type": "object",
                    "properties": {
                        "plan_id": { "type": "string" },
                        "title": { "type": "string" },
                        "progress": { "type": "string" },
                        "completed_steps": { "type": "array", "items": { "type": "object" } },
                        "pending_steps": { "type": "array", "items": { "type": "object" } },
                        "next_step": { "type": "object" },
                        "is_complete": { "type": "boolean" },
                        "instruction": { "type": "string" },
                        "warning": { "type": "string" },
                        "error": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "base-tools",
                "Базовые инструменты",
                "Набор базовых инструментов для взаимодействия модели с внешней средой",
                "command_exec",
                "Выполняет shell-команду после подтверждения пользователем",
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
            package_tool_with_output(
                "base-tools",
                "Базовые инструменты",
                "Набор базовых инструментов для взаимодействия модели с внешней средой",
                "vector_store_search_tool",
                "Ищет релевантные фрагменты в подключённом векторном хранилище",
                object_schema(vector_search_props, &["query"]),
                json!({
                    "type": "object",
                    "properties": {
                        "vectorStorageId": { "type": "string" },
                        "items": { "type": "array", "items": { "type": "object" } },
                        "hits": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": { "type": "string" },
                                    "text": { "type": "string" },
                                    "score": { "type": "number" }
                                }
                            }
                        },
                        "request": { "type": "object" }
                    }
                }),
            ),
        ],
    }
}
