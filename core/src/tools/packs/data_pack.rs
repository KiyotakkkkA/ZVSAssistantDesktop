use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    number_schema, object_schema, package_tool_with_output, string_schema,
    BuiltinToolPackage,
};

pub fn build_data_pack() -> BuiltinToolPackage {
    let mut vector_search_props = BTreeMap::new();
    vector_search_props.insert("query".to_owned(), string_schema("Поисковый запрос"));
    vector_search_props.insert("limit".to_owned(), number_schema("Лимит результатов 1..10"));

    BuiltinToolPackage {
        id: "data-tools".to_owned(),
        title: "Работа с данными".to_owned(),
        description: "Инструменты для поиска и извлечения данных".to_owned(),
        tools: vec![package_tool_with_output(
            "data-tools",
            "Работа с данными",
            "Инструменты для поиска и извлечения данных",
            "vector_store_search_tool",
            "Назначение: семантический поиск в подключённом векторном хранилище проекта. Вход: query:string (обязательный), limit:number (опционально, обычно 1..10). Выход: vectorStorageId:string, hits[] (id, text, score, fileName, chunkIndex), а также request/object с метаданными поиска.",
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
        )],
    }
}
