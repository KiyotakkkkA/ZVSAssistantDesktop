use std::collections::BTreeMap;

use crate::domain::chat::{OllamaToolDefinition, OllamaToolFunction, ToolParameterSchema};

fn string_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "string".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

fn number_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "number".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

fn boolean_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "boolean".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

fn enum_string_schema(description: &str, values: &[&str]) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "string".to_owned(),
        description: Some(description.to_owned()),
        enum_values: Some(values.iter().map(|value| (*value).to_owned()).collect()),
        properties: None,
        items: None,
        required: None,
    }
}

fn array_of_strings_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "array".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: Some(Box::new(ToolParameterSchema {
            schema_type: "string".to_owned(),
            description: None,
            enum_values: None,
            properties: None,
            items: None,
            required: None,
        })),
        required: None,
    }
}

fn object_schema(
    properties: BTreeMap<String, ToolParameterSchema>,
    required: &[&str],
) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "object".to_owned(),
        description: None,
        enum_values: None,
        properties: Some(properties),
        items: None,
        required: Some(required.iter().map(|item| (*item).to_owned()).collect()),
    }
}

fn tool(
    name: &str,
    description: &str,
    parameters: ToolParameterSchema,
) -> OllamaToolDefinition {
    OllamaToolDefinition {
        kind: "function".to_owned(),
        function: OllamaToolFunction {
            name: name.to_owned(),
            description: Some(description.to_owned()),
            parameters,
        },
    }
}

pub fn builtin_tool_definitions() -> Vec<OllamaToolDefinition> {
    let mut command_exec_props = BTreeMap::new();
    command_exec_props.insert("command".to_owned(), string_schema("Shell-команда для выполнения"));
    command_exec_props.insert(
        "cwd".to_owned(),
        string_schema("Рабочая директория выполнения (опционально)"),
    );

    let mut vector_search_props = BTreeMap::new();
    vector_search_props.insert("query".to_owned(), string_schema("Поисковый запрос"));
    vector_search_props.insert("limit".to_owned(), number_schema("Лимит результатов 1..10"));

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

    let mut qa_props = BTreeMap::new();
    qa_props.insert("question".to_owned(), string_schema("Вопрос пользователю"));
    qa_props.insert("reason".to_owned(), string_schema("Причина уточнения"));
    qa_props.insert(
        "selectAnswers".to_owned(),
        array_of_strings_schema("Варианты ответа"),
    );
    qa_props.insert(
        "userAnswer".to_owned(),
        string_schema("Подсказка по ожидаемому ответу"),
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

    let mut schedule_props = BTreeMap::new();
    schedule_props.insert(
        "date_value".to_owned(),
        string_schema("Дата в формате YYYY-MM-DD"),
    );

    vec![
        tool(
            "command_exec",
            "Выполняет shell-команду после подтверждения пользователем",
            object_schema(command_exec_props, &["command"]),
        ),
        tool(
            "vector_store_search_tool",
            "Ищет релевантные фрагменты в подключённом векторном хранилище",
            object_schema(vector_search_props, &["query"]),
        ),
        tool(
            "web_search",
            "Ищет информацию в интернете по текстовому запросу",
            object_schema(web_search_props, &["request"]),
        ),
        tool(
            "web_fetch",
            "Загружает содержимое веб-страницы",
            object_schema(web_fetch_props, &["url"]),
        ),
        tool(
            "open_url",
            "Открывает URL во встроенном браузерном контуре",
            object_schema(open_url_props, &["url"]),
        ),
        tool(
            "get_page_snapshot",
            "Возвращает структурированный снимок страницы",
            object_schema(snapshot_props, &[]),
        ),
        tool(
            "interract_with",
            "Выполняет действие click/type по CSS selector",
            object_schema(interact_props, &["action", "selector"]),
        ),
        tool(
            "close_browser",
            "Закрывает текущую браузерную сессию",
            object_schema(BTreeMap::new(), &[]),
        ),
        tool(
            "send_telegram_msg",
            "Отправляет сообщение пользователю через Telegram-бота",
            object_schema(telegram_send_props, &["message"]),
        ),
        tool(
            "get_telegram_unread_msgs",
            "Получает непрочитанные сообщения пользователя из Telegram",
            object_schema(telegram_unread_props, &[]),
        ),
        tool(
            "list_directory",
            "Получает список файлов и папок",
            object_schema(list_dir_props, &["cwd"]),
        ),
        tool(
            "create_file",
            "Создаёт новый файл",
            object_schema(create_file_props, &["cwd", "filename"]),
        ),
        tool(
            "create_dir",
            "Создаёт директорию",
            object_schema(create_dir_props, &["cwd", "dirname"]),
        ),
        tool(
            "read_file",
            "Читает содержимое файла",
            object_schema(read_file_props, &["filePath", "readAll"]),
        ),
        tool(
            "qa_tool",
            "Формализует уточняющий вопрос к пользователю",
            object_schema(qa_props, &["question"]),
        ),
        tool(
            "planning_tool",
            "Управляет планом выполнения задачи",
            object_schema(planning_props, &["action"]),
        ),
        tool(
            "schedule_mirea_tool",
            "Загружает и группирует расписание МИРЭА по дням",
            object_schema(schedule_props, &["date_value"]),
        ),
    ]
}
