use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    boolean_schema, enum_string_schema, number_schema, object_schema,
    package_tool_with_output, string_schema, BuiltinToolPackage,
};

pub fn build_communication_pack() -> BuiltinToolPackage {
    let mut telegram_send_props = BTreeMap::new();
    telegram_send_props.insert("message".to_owned(), string_schema("Текст сообщения"));
    telegram_send_props.insert(
        "parse_mode".to_owned(),
        enum_string_schema("Режим форматирования", &["Markdown", "HTML", "MarkdownV2"]),
    );

    let mut telegram_unread_props = BTreeMap::new();
    telegram_unread_props.insert("limit".to_owned(), number_schema("Лимит сообщений"));
    telegram_unread_props.insert(
        "mark_as_read".to_owned(),
        boolean_schema("Пометить как прочитанные"),
    );

    BuiltinToolPackage {
        id: "communication-tools".to_owned(),
        title: "Мессенджеры".to_owned(),
        description: "Инструменты для отправки и чтения сообщений пользователя".to_owned(),
        tools: vec![
            package_tool_with_output(
                "communication-tools",
                "Мессенджеры",
                "Инструменты для отправки и чтения сообщений пользователя",
                "send_telegram_msg",
                "Отправляет сообщение пользователю через Telegram-бота",
                object_schema(telegram_send_props, &["message"]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "message": { "type": "string" },
                        "error": { "type": "string" },
                        "message_id": { "type": "number" }
                    }
                }),
            ),
            package_tool_with_output(
                "communication-tools",
                "Мессенджеры",
                "Инструменты для отправки и чтения сообщений пользователя",
                "get_telegram_unread_msgs",
                "Получает непрочитанные сообщения пользователя из Telegram",
                object_schema(telegram_unread_props, &[]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "message": { "type": "string" },
                        "error": { "type": "string" },
                        "unread_count": { "type": "number" },
                        "updates_count": { "type": "number" },
                        "offset_used": { "type": "number" },
                        "next_offset": { "type": "number" },
                        "messages": { "type": "array", "items": { "type": "object" } }
                    }
                }),
            ),
        ],
    }
}
