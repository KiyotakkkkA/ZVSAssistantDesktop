use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    boolean_schema, enum_string_schema, number_schema, object_schema,
    package_tool_with_output, string_schema, BuiltinToolPackage,
};

pub fn build_browser_pack() -> BuiltinToolPackage {
    let mut web_search_props = BTreeMap::new();
    web_search_props.insert("request".to_owned(), string_schema("Поисковый запрос"));

    let mut web_fetch_props = BTreeMap::new();
    web_fetch_props.insert("url".to_owned(), string_schema("Абсолютный URL"));

    let mut open_url_props = BTreeMap::new();
    open_url_props.insert("url".to_owned(), string_schema("URL для открытия"));
    open_url_props.insert("timeoutMs".to_owned(), number_schema("Таймаут в миллисекундах"));

    let mut snapshot_props = BTreeMap::new();
    snapshot_props.insert("maxElements".to_owned(), number_schema("Лимит элементов"));

    let mut interact_props = BTreeMap::new();
    interact_props.insert(
        "action".to_owned(),
        enum_string_schema("Действие click/type", &["click", "type"]),
    );
    interact_props.insert("selector".to_owned(), string_schema("CSS селектор"));
    interact_props.insert("text".to_owned(), string_schema("Текст для action=type"));
    interact_props.insert("submit".to_owned(), boolean_schema("Отправлять Enter после ввода"));
    interact_props.insert(
        "waitForNavigationMs".to_owned(),
        number_schema("Ожидание навигации после действия"),
    );

    BuiltinToolPackage {
        id: "browser-tools".to_owned(),
        title: "Браузерные инструменты".to_owned(),
        description: "Инструменты для взаимодействия модели с браузером".to_owned(),
        tools: vec![
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "web_search",
                "Ищет информацию в интернете по текстовому запросу",
                object_schema(web_search_props, &["request"]),
                json!({
                    "type": "object",
                    "properties": {
                        "result": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "web_fetch",
                "Загружает содержимое веб-страницы",
                object_schema(web_fetch_props, &["url"]),
                json!({
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "open_url",
                "Открывает URL во встроенном браузерном контуре",
                object_schema(open_url_props, &["url"]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "requestedUrl": { "type": "string" },
                        "finalUrl": { "type": "string" },
                        "title": { "type": "string" },
                        "redirected": { "type": "boolean" },
                        "redirects": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "from": { "type": "string" },
                                    "to": { "type": "string" }
                                }
                            }
                        },
                        "statusCode": { "type": "number" },
                        "loadTimeMs": { "type": "number" },
                        "error": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "get_page_snapshot",
                "Возвращает структурированный снимок страницы",
                object_schema(snapshot_props, &[]),
                json!({
                    "type": "object",
                    "properties": {
                        "url": { "type": "string" },
                        "title": { "type": "string" },
                        "headings": { "type": "array", "items": { "type": "string" } },
                        "elements": { "type": "array", "items": { "type": "object" } },
                        "textPreview": { "type": "string" },
                        "capturedAt": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "interact_with",
                "Выполняет действие click/type по CSS selector",
                object_schema(interact_props, &["action", "selector"]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "action": { "type": "string" },
                        "selector": { "type": "string" },
                        "elementTag": { "type": "string" },
                        "url": { "type": "string" },
                        "title": { "type": "string" },
                        "waitedMs": { "type": "number" },
                        "error": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "browser-tools",
                "Браузерные инструменты",
                "Инструменты для взаимодействия модели с браузером",
                "close_browser",
                "Закрывает текущую браузерную сессию",
                object_schema(BTreeMap::new(), &[]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "hadSession": { "type": "boolean" }
                    }
                }),
            ),
        ],
    }
}
