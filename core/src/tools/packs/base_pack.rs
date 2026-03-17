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
                "Назначение: запрос уточнений у пользователя, когда данных недостаточно. Вход: questions[] (каждый объект принимает question:string, опционально reason:string, selectAnswers:string[], userAnswerHint:string). Выход: status='awaiting_user_response', questions[] (нормализованный список вопросов), instruction:string. Правило: один вопрос = один недостающий факт; не задавай длинные объединённые вопросы.",
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
                "Назначение: пошаговое планирование и контроль прогресса. Вход: action:string из [create, complete_step, get_status]; для create передай title:string и steps:string[]; для complete_step передай plan_id:string и step_id:number; для get_status передай plan_id:string. Выход: plan_id, title, progress, completed_steps[], pending_steps[], next_step, is_complete, а также instruction/warning/error в зависимости от операции.",
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
        ],
    }
}
