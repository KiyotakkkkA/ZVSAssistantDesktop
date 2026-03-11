use std::collections::BTreeMap;

use serde_json::json;

use crate::tools::builtin_tools::{
    boolean_schema, number_schema, object_schema, package_tool_with_output,
    string_schema, BuiltinToolPackage,
};

pub fn build_filesystem_pack() -> BuiltinToolPackage {
    let mut list_dir_props = BTreeMap::new();
    list_dir_props.insert("cwd".to_owned(), string_schema("Каталог для просмотра"));

    let mut create_file_props = BTreeMap::new();
    create_file_props.insert("cwd".to_owned(), string_schema("Базовый каталог"));
    create_file_props.insert("filename".to_owned(), string_schema("Имя файла"));
    create_file_props.insert("content".to_owned(), string_schema("Содержимое"));

    let mut create_dir_props = BTreeMap::new();
    create_dir_props.insert("cwd".to_owned(), string_schema("Базовый каталог"));
    create_dir_props.insert("dirname".to_owned(), string_schema("Имя директории"));

    let mut read_file_props = BTreeMap::new();
    read_file_props.insert("filePath".to_owned(), string_schema("Путь к файлу"));
    read_file_props.insert("readAll".to_owned(), boolean_schema("Читать весь файл"));
    read_file_props.insert("readFromRow".to_owned(), number_schema("Начальная строка"));
    read_file_props.insert("readToRow".to_owned(), number_schema("Конечная строка"));

    BuiltinToolPackage {
        id: "filesystem-tools".to_owned(),
        title: "Файловая система".to_owned(),
        description: "Инструменты для работы с файлами и директориями".to_owned(),
        tools: vec![
            package_tool_with_output(
                "filesystem-tools",
                "Файловая система",
                "Инструменты для работы с файлами и директориями",
                "list_directory",
                "Получает список файлов и папок",
                object_schema(list_dir_props, &["cwd"]),
                json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "entries": { "type": "array", "items": { "type": "object" } }
                    }
                }),
            ),
            package_tool_with_output(
                "filesystem-tools",
                "Файловая система",
                "Инструменты для работы с файлами и директориями",
                "create_file",
                "Создаёт новый файл",
                object_schema(create_file_props, &["cwd", "filename"]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "path": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "filesystem-tools",
                "Файловая система",
                "Инструменты для работы с файлами и директориями",
                "create_dir",
                "Создаёт директорию",
                object_schema(create_dir_props, &["cwd", "dirname"]),
                json!({
                    "type": "object",
                    "properties": {
                        "success": { "type": "boolean" },
                        "path": { "type": "string" }
                    }
                }),
            ),
            package_tool_with_output(
                "filesystem-tools",
                "Файловая система",
                "Инструменты для работы с файлами и директориями",
                "read_file",
                "Читает содержимое файла",
                object_schema(read_file_props, &["filePath", "readAll"]),
                json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" },
                        "totalLines": { "type": "number" },
                        "fromLine": { "type": "number" },
                        "toLine": { "type": "number" }
                    }
                }),
            ),
        ],
    }
}
