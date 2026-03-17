use async_trait::async_trait;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::application::ports::ToolExecutorPort;
use crate::domain::chat::ToolExecutionRequest;
use crate::domain::error::CoreError;
use crate::tools::packs::studying_pack::fetch_mirea_schedule_by_date;

#[async_trait]
pub trait BuiltinToolHostPort: Send + Sync {
    async fn exec_shell(
        &self,
        request: &ToolExecutionRequest,
        command: &str,
        cwd: Option<&str>,
    ) -> Result<Value, CoreError>;
    async fn vector_search(&self, request: &ToolExecutionRequest) -> Result<Value, CoreError>;
    async fn web_search(&self, query: &str) -> Result<Value, CoreError>;
    async fn web_fetch(&self, url: &str) -> Result<Value, CoreError>;
    async fn browser_open_url(&self, args: &Value) -> Result<Value, CoreError>;
    async fn browser_snapshot(&self, args: &Value) -> Result<Value, CoreError>;
    async fn browser_interact(&self, args: &Value) -> Result<Value, CoreError>;
    async fn browser_close(&self) -> Result<Value, CoreError>;
    async fn telegram_send(&self, args: &Value) -> Result<Value, CoreError>;
    async fn telegram_unread(&self, args: &Value) -> Result<Value, CoreError>;
    async fn fs_list_directory(&self, cwd: &str) -> Result<Value, CoreError>;
    async fn fs_create_file(&self, cwd: &str, filename: &str, content: &str) -> Result<Value, CoreError>;
    async fn fs_create_dir(&self, cwd: &str, dirname: &str) -> Result<Value, CoreError>;
    async fn fs_read_file(
        &self,
        file_path: &str,
        read_all: bool,
        from_row: Option<u32>,
        to_row: Option<u32>,
    ) -> Result<Value, CoreError>;
    async fn fs_delete_file(&self, file_path: &str) -> Result<Value, CoreError>;
    async fn fs_text_search(&self, cwd: &str, exp: &str) -> Result<Value, CoreError>;
    async fn tools_store_calling_doc(&self, payload: &Value) -> Result<Value, CoreError>;
    async fn tools_get_calling_doc(&self, doc_id: &str) -> Result<Value, CoreError>;
}

#[derive(Debug, Clone)]
struct PlanStep {
    id: u32,
    description: String,
    completed: bool,
}

#[derive(Debug, Clone)]
struct Plan {
    id: String,
    title: String,
    steps: Vec<PlanStep>,
}

#[derive(Clone)]
pub struct BuiltinToolsExecutor {
    host_port: Arc<dyn BuiltinToolHostPort>,
    plan_store: Arc<Mutex<HashMap<String, Plan>>>,
}

impl BuiltinToolsExecutor {
    fn with_extra_field(base: Value, key: &str, value: Value) -> Value {
        if let Value::Object(mut map) = base {
            map.insert(key.to_owned(), value);
            Value::Object(map)
        } else {
            json!({ key: value })
        }
    }

    fn truncate_text(text: &str, max_len: usize) -> String {
        if text.chars().count() <= max_len {
            return text.to_owned();
        }

        let truncated = text.chars().take(max_len).collect::<String>();
        format!(
            "{}... [truncated, total_chars={}]",
            truncated,
            text.chars().count()
        )
    }

    fn sanitize_value_compact(value: &Value, max_text_len: usize) -> Value {
        match value {
            Value::String(text) => Value::String(Self::truncate_text(text, max_text_len)),
            Value::Array(items) => {
                Value::Array(items.iter().map(|item| Self::sanitize_value_compact(item, max_text_len)).collect())
            }
            Value::Object(object) => {
                let mut map = Map::new();
                for (key, item) in object {
                    map.insert(key.clone(), Self::sanitize_value_compact(item, max_text_len));
                }
                Value::Object(map)
            }
            _ => value.clone(),
        }
    }

    fn pick_object_fields(object: &Map<String, Value>, keys: &[&str]) -> Map<String, Value> {
        let mut selected = Map::new();
        for key in keys {
            if let Some(value) = object.get(*key) {
                selected.insert((*key).to_owned(), value.clone());
            }
        }
        selected
    }

    fn sanitize_schedule_result(value: Value) -> Value {
        let Some(days) = value.as_object() else {
            return value;
        };

        let mut normalized_days = Map::new();

        for (date_key, day_info) in days {
            let Some(day_object) = day_info.as_object() else {
                continue;
            };

            let weekday = day_object
                .get("weekday")
                .cloned()
                .unwrap_or(Value::String("".to_owned()));

            let lessons = day_object
                .get("lessons")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .take(16)
                        .filter_map(Value::as_object)
                        .map(|lesson| {
                            Value::Object(Self::pick_object_fields(
                                lesson,
                                &["time", "subject", "type", "teacher", "location"],
                            ))
                        })
                        .collect::<Vec<Value>>()
                })
                .unwrap_or_default();

            let mut day_payload = Map::new();
            day_payload.insert("weekday".to_owned(), weekday);
            day_payload.insert("lessons".to_owned(), Value::Array(lessons));

            normalized_days.insert(date_key.clone(), Value::Object(day_payload));
        }

        Value::Object(normalized_days)
    }

    fn sanitize_tool_result_for_model(tool_name: &str, raw_result: Value) -> Value {
        match tool_name {
            "command_exec" => {
                let Some(object) = raw_result.as_object() else {
                    return Self::sanitize_value_compact(&raw_result, 3000);
                };

                let mut result = Self::pick_object_fields(
                    object,
                    &["command", "cwd", "isAdmin", "exitCode", "stdout", "stderr", "error"],
                );

                if let Some(Value::String(stdout)) = result.get("stdout") {
                    result.insert("stdout".to_owned(), Value::String(Self::truncate_text(stdout, 5000)));
                }
                if let Some(Value::String(stderr)) = result.get("stderr") {
                    result.insert("stderr".to_owned(), Value::String(Self::truncate_text(stderr, 3000)));
                }

                Value::Object(result)
            }
            "vector_store_search_tool" => {
                let Some(object) = raw_result.as_object() else {
                    return Self::sanitize_value_compact(&raw_result, 2500);
                };

                let mut result = Map::new();
                if let Some(vector_storage_id) = object.get("vectorStorageId") {
                    result.insert("vectorStorageId".to_owned(), vector_storage_id.clone());
                }

                let hits = object
                    .get("hits")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .take(8)
                            .filter_map(Value::as_object)
                            .map(|hit| {
                                let mut hit_obj = Self::pick_object_fields(
                                    hit,
                                    &["id", "score", "fileName", "chunkIndex", "text"],
                                );
                                if let Some(Value::String(text)) = hit_obj.get("text") {
                                    hit_obj.insert("text".to_owned(), Value::String(Self::truncate_text(text, 700)));
                                }
                                Value::Object(hit_obj)
                            })
                            .collect::<Vec<Value>>()
                    })
                    .unwrap_or_default();

                result.insert("hits".to_owned(), Value::Array(hits));
                Value::Object(result)
            }
            "web_search" => Self::sanitize_value_compact(&raw_result, 4000),
            "web_fetch" => {
                let Some(object) = raw_result.as_object() else {
                    return Self::sanitize_value_compact(&raw_result, 6000);
                };

                let mut result = Self::pick_object_fields(object, &["url", "title", "content", "error"]);
                if let Some(Value::String(content)) = result.get("content") {
                    result.insert("content".to_owned(), Value::String(Self::truncate_text(content, 8000)));
                }
                Value::Object(result)
            }
            "open_url" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                Value::Object(Self::pick_object_fields(
                    object,
                    &["success", "requestedUrl", "finalUrl", "title", "statusCode", "error"],
                ))
            }
            "get_page_snapshot" => {
                let Some(object) = raw_result.as_object() else {
                    return Self::sanitize_value_compact(&raw_result, 3000);
                };

                let mut result = Self::pick_object_fields(
                    object,
                    &["url", "title", "headings", "textPreview", "capturedAt"],
                );

                if let Some(Value::String(text_preview)) = result.get("textPreview") {
                    result.insert(
                        "textPreview".to_owned(),
                        Value::String(Self::truncate_text(text_preview, 3000)),
                    );
                }

                if let Some(elements) = object.get("elements").and_then(Value::as_array) {
                    let compact_elements = elements
                        .iter()
                        .take(24)
                        .filter_map(Value::as_object)
                        .map(|item| {
                            Value::Object(Self::pick_object_fields(
                                item,
                                &["tag", "role", "selector", "text", "href", "value"],
                            ))
                        })
                        .collect::<Vec<Value>>();

                    result.insert("elements".to_owned(), Value::Array(compact_elements));
                }

                Value::Object(result)
            }
            "interact_with" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                Value::Object(Self::pick_object_fields(
                    object,
                    &["success", "action", "selector", "url", "title", "error"],
                ))
            }
            "close_browser" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                Value::Object(Self::pick_object_fields(object, &["success", "hadSession"]))
            }
            "send_telegram_msg" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                Value::Object(Self::pick_object_fields(
                    object,
                    &["success", "message", "error", "message_id"],
                ))
            }
            "get_telegram_unread_msgs" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };

                let mut result = Self::pick_object_fields(
                    object,
                    &["success", "message", "error", "unread_count"],
                );

                let messages = object
                    .get("messages")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .take(12)
                            .filter_map(Value::as_object)
                            .map(|item| {
                                let mut msg = Self::pick_object_fields(
                                    item,
                                    &["text", "date", "message_id"],
                                );

                                if let Some(Value::Object(chat)) = item.get("chat") {
                                    msg.insert(
                                        "chat".to_owned(),
                                        Value::Object(Self::pick_object_fields(
                                            chat,
                                            &["id", "title", "username"],
                                        )),
                                    );
                                }

                                if let Some(Value::Object(from)) = item.get("from") {
                                    msg.insert(
                                        "from".to_owned(),
                                        Value::Object(Self::pick_object_fields(
                                            from,
                                            &["id", "first_name", "username"],
                                        )),
                                    );
                                }

                                Value::Object(msg)
                            })
                            .collect::<Vec<Value>>()
                    })
                    .unwrap_or_default();

                result.insert("messages".to_owned(), Value::Array(messages));
                Value::Object(result)
            }
            "list_directory" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };

                let mut result = Map::new();
                if let Some(path) = object.get("path") {
                    result.insert("path".to_owned(), path.clone());
                }
                let entries = object
                    .get("entries")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .take(200)
                            .filter_map(Value::as_object)
                            .map(|entry| {
                                Value::Object(Self::pick_object_fields(entry, &["name", "type"]))
                            })
                            .collect::<Vec<Value>>()
                    })
                    .unwrap_or_default();
                result.insert("entries".to_owned(), Value::Array(entries));
                Value::Object(result)
            }
            "create_file" | "create_dir" | "delete_file" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                Value::Object(Self::pick_object_fields(object, &["success", "path", "error"]))
            }
            "read_file" => {
                let Some(object) = raw_result.as_object() else {
                    return Self::sanitize_value_compact(&raw_result, 8000);
                };
                let mut result = Self::pick_object_fields(
                    object,
                    &["path", "content", "totalLines", "fromLine", "toLine"],
                );
                if let Some(Value::String(content)) = result.get("content") {
                    result.insert("content".to_owned(), Value::String(Self::truncate_text(content, 8000)));
                }
                Value::Object(result)
            }
            "text_search" => {
                let Some(object) = raw_result.as_object() else {
                    return raw_result;
                };
                let mut result = Self::pick_object_fields(object, &["cwd", "exp", "error"]);
                let matches = object
                    .get("matches")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .take(120)
                            .filter_map(Value::as_object)
                            .map(|item| {
                                Value::Object(Self::pick_object_fields(
                                    item,
                                    &["filePath", "line", "text", "match"],
                                ))
                            })
                            .collect::<Vec<Value>>()
                    })
                    .unwrap_or_default();
                result.insert("matches".to_owned(), Value::Array(matches));
                Value::Object(result)
            }
            "schedule_mirea_tool" => Self::sanitize_schedule_result(raw_result),
            "qa_tool" | "planning_tool" | "get_tools_calling" => {
                Self::sanitize_value_compact(&raw_result, 3000)
            }
            _ => Self::sanitize_value_compact(&raw_result, 3000),
        }
    }

    pub fn new(host_port: Arc<dyn BuiltinToolHostPort>) -> Self {
        Self {
            host_port,
            plan_store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn execute_command_exec(
        &self,
        request: &ToolExecutionRequest,
    ) -> Result<Value, CoreError> {
        let args = &request.args;
        let command = args
            .get("command")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        if command.is_empty() {
            return Err(CoreError::Validation("command is required".to_owned()));
        }

        let cwd = args
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());

        self.host_port.exec_shell(request, command, cwd).await
    }

    async fn execute_web_search(&self, args: &Value) -> Result<Value, CoreError> {
        let query = args
            .get("request")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        self.host_port.web_search(query).await
    }

    async fn execute_web_fetch(&self, args: &Value) -> Result<Value, CoreError> {
        let url = args
            .get("url")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        self.host_port.web_fetch(url).await
    }

    async fn execute_list_directory(&self, args: &Value) -> Result<Value, CoreError> {
        let cwd = args
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        if cwd.is_empty() {
            return Ok(json!({ "error": "Необходимо указать параметр cwd." }));
        }

        self.host_port.fs_list_directory(cwd).await
    }

    async fn execute_create_file(&self, args: &Value) -> Result<Value, CoreError> {
        let cwd = args
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        let filename = args
            .get("filename")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        let content = args.get("content").and_then(Value::as_str).unwrap_or_default();

        if cwd.is_empty() || filename.is_empty() {
            return Ok(json!({ "error": "Необходимо указать cwd и filename." }));
        }

        self.host_port.fs_create_file(cwd, filename, content).await
    }

    async fn execute_create_dir(&self, args: &Value) -> Result<Value, CoreError> {
        let cwd = args
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        let dirname = args
            .get("dirname")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();

        if cwd.is_empty() || dirname.is_empty() {
            return Ok(json!({ "error": "Необходимо указать cwd и dirname." }));
        }

        self.host_port.fs_create_dir(cwd, dirname).await
    }

    async fn execute_read_file(&self, args: &Value) -> Result<Value, CoreError> {
        let file_path = args
            .get("filePath")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        if file_path.is_empty() {
            return Ok(json!({ "error": "Необходимо указать filePath." }));
        }

        let read_all = args.get("readAll").and_then(Value::as_bool).unwrap_or(true);
        let from_row = args.get("readFromRow").and_then(Value::as_u64).map(|v| v as u32);
        let to_row = args.get("readToRow").and_then(Value::as_u64).map(|v| v as u32);

        self.host_port
            .fs_read_file(file_path, read_all, from_row, to_row)
            .await
    }

    async fn execute_delete_file(&self, args: &Value) -> Result<Value, CoreError> {
        let file_path = args
            .get("filePath")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();

        if file_path.is_empty() {
            return Ok(json!({ "error": "Необходимо указать filePath." }));
        }

        self.host_port.fs_delete_file(file_path).await
    }

    async fn execute_text_search(&self, args: &Value) -> Result<Value, CoreError> {
        let cwd = args
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();
        let exp = args
            .get("exp")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();

        if cwd.is_empty() || exp.is_empty() {
            return Ok(json!({ "error": "Необходимо указать cwd и exp." }));
        }

        self.host_port.fs_text_search(cwd, exp).await
    }

    fn format_plan_response(plan: &Plan) -> Value {
        let completed: Vec<Value> = plan
            .steps
            .iter()
            .filter(|step| step.completed)
            .map(|step| {
                json!({
                    "id": step.id,
                    "description": step.description,
                })
            })
            .collect();
        let pending: Vec<Value> = plan
            .steps
            .iter()
            .filter(|step| !step.completed)
            .map(|step| {
                json!({
                    "id": step.id,
                    "description": step.description,
                })
            })
            .collect();

        json!({
            "plan_id": plan.id,
            "title": plan.title,
            "progress": format!("{}/{}", completed.len(), plan.steps.len()),
            "completed_steps": completed,
            "pending_steps": pending,
            "next_step": pending.first().cloned().unwrap_or(Value::Null),
            "is_complete": pending.is_empty(),
        })
    }

    async fn execute_planning_tool(&self, args: &Value) -> Result<Value, CoreError> {
        let action = args
            .get("action")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();

        if action == "create" {
            let title = args
                .get("title")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("Без названия")
                .to_owned();
            let raw_steps = args
                .get("steps")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let steps: Vec<String> = raw_steps
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
                .collect();

            if steps.is_empty() {
                return Ok(json!({ "error": "Необходимо передать хотя бы один шаг в поле 'steps'." }));
            }

            let plan_id = format!("plan_{}", uuid::Uuid::new_v4().simple());
            let plan = Plan {
                id: plan_id.clone(),
                title,
                steps: steps
                    .into_iter()
                    .enumerate()
                    .map(|(index, description)| PlanStep {
                        id: (index as u32) + 1,
                        description,
                        completed: false,
                    })
                    .collect(),
            };

            let response = Self::format_plan_response(&plan);
            let mut store = self.plan_store.lock().await;
            store.insert(plan_id, plan);

            return Ok(Self::with_extra_field(
                response,
                "instruction",
                json!("План создан. Выполняй шаги строго по порядку. После каждого шага вызывай complete_step с соответствующим step_id."),
            ));
        }

        if action == "complete_step" {
            let plan_id = args
                .get("plan_id")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default();
            let step_id = args.get("step_id").and_then(Value::as_u64).map(|v| v as u32);

            let mut store = self.plan_store.lock().await;
            let Some(plan) = store.get_mut(plan_id) else {
                return Ok(json!({
                    "error": format!("План с id '{}' не найден. Сначала создай план через action='create'.", plan_id),
                }));
            };

            let Some(step_id) = step_id else {
                return Ok(json!({ "error": "Необходимо указать step_id — номер выполненного шага." }));
            };

            let Some(step) = plan.steps.iter_mut().find(|item| item.id == step_id) else {
                return Ok(json!({
                    "error": format!("Шаг с id={} не найден в плане '{}'.", step_id, plan.title),
                }));
            };

            if step.completed {
                let status = Self::format_plan_response(plan);
                return Ok(Self::with_extra_field(
                    status,
                    "warning",
                    json!(format!("Шаг {} уже был отмечен как выполненный.", step_id)),
                ));
            }

            step.completed = true;
            let status = Self::format_plan_response(plan);
            let is_complete = status
                .get("is_complete")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            let instruction = if is_complete {
                "Все шаги выполнены. План завершён.".to_owned()
            } else {
                format!("Шаг {} отмечен выполненным.", step_id)
            };

            return Ok(Self::with_extra_field(
                status,
                "instruction",
                json!(instruction),
            ));
        }

        if action == "get_status" {
            let plan_id = args
                .get("plan_id")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default();

            let store = self.plan_store.lock().await;
            let Some(plan) = store.get(plan_id) else {
                return Ok(json!({
                    "error": format!("План с id '{}' не найден.", plan_id),
                }));
            };

            return Ok(Self::format_plan_response(plan));
        }

        Ok(json!({
            "error": format!("Неизвестное действие '{}'. Используй: 'create', 'complete_step', 'get_status'.", action),
        }))
    }
}

#[async_trait]
impl ToolExecutorPort for BuiltinToolsExecutor {
    async fn execute_tool(&self, request: ToolExecutionRequest) -> Result<Value, CoreError> {
        let args = &request.args;

        let raw_result = match request.tool_name.as_str() {
            "command_exec" => self.execute_command_exec(&request).await,
            "vector_store_search_tool" => self.host_port.vector_search(&request).await,
            "web_search" => self.execute_web_search(args).await,
            "web_fetch" => self.execute_web_fetch(args).await,
            "open_url" => self.host_port.browser_open_url(args).await,
            "get_page_snapshot" => self.host_port.browser_snapshot(args).await,
            "interact_with" => self.host_port.browser_interact(args).await,
            "close_browser" => self.host_port.browser_close().await,
            "send_telegram_msg" => self.host_port.telegram_send(args).await,
            "get_telegram_unread_msgs" => self.host_port.telegram_unread(args).await,
            "list_directory" => self.execute_list_directory(args).await,
            "create_file" => self.execute_create_file(args).await,
            "create_dir" => self.execute_create_dir(args).await,
            "read_file" => self.execute_read_file(args).await,
            "delete_file" => self.execute_delete_file(args).await,
            "text_search" => self.execute_text_search(args).await,
            "get_tools_calling" => {
                let doc_id = args
                    .get("doc_id")
                    .or_else(|| args.get("docId"))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .unwrap_or_default();

                if doc_id.is_empty() {
                    return Ok(json!({
                        "ok": false,
                        "error": "validation",
                        "message": "Необходимо передать doc_id",
                    }));
                }

                return self.host_port.tools_get_calling_doc(doc_id).await;
            }
            "qa_tool" => {
                let questions = args
                    .get("questions")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items.iter()
                            .filter_map(|item| match item {
                                Value::String(question) => {
                                    let trimmed = question.trim();

                                    if trimmed.is_empty() {
                                        None
                                    } else {
                                        Some(json!({
                                            "question": trimmed,
                                            "reason": "",
                                            "selectAnswers": [],
                                            "userAnswerHint": "",
                                        }))
                                    }
                                }
                                Value::Object(_) => Some(item.clone()),
                                _ => None,
                            })
                            .collect::<Vec<Value>>()
                    })
                    .filter(|items| !items.is_empty())
                    .unwrap_or_else(|| {
                        let question = args
                            .get("question")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .unwrap_or_default();

                        if question.is_empty() {
                            Vec::new()
                        } else {
                            vec![json!({
                                "question": question,
                                "reason": args.get("reason").and_then(Value::as_str).unwrap_or_default(),
                                "selectAnswers": args.get("selectAnswers").cloned().unwrap_or_else(|| json!([])),
                                "userAnswerHint": args
                                    .get("userAnswerHint")
                                    .or_else(|| args.get("userAnswer"))
                                    .and_then(Value::as_str)
                                    .unwrap_or_default(),
                            })]
                        }
                    });

                Ok(json!({
                    "status": "awaiting_user_response",
                    "questions": questions,
                    "instruction": "Задай пользователю все вопросы из списка, дождись ответов на каждый и продолжай только после получения полного набора ответов.",
                }))
            }
            "planning_tool" => self.execute_planning_tool(args).await,
            "schedule_mirea_tool" => {
                let date_value = args
                    .get("date_value")
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .unwrap_or_default();

                if !Regex::new(r"^\d{4}-\d{2}-\d{2}$")
                    .map_err(|err| CoreError::Internal(err.to_string()))?
                    .is_match(date_value)
                {
                    return Err(CoreError::Validation(
                        "Parameter date_value must be in YYYY-MM-DD format".to_owned(),
                    ));
                }

                fetch_mirea_schedule_by_date(date_value).await
            }
            _ => Err(CoreError::Tool(format!(
                "Tool {} не поддерживается в core runtime",
                request.tool_name
            ))),
        }?;

        let iteration = request
            .call_id
            .split("tool_call_")
            .last()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(1);

        let dialog_id = request
            .runtime_context
            .as_ref()
            .and_then(|ctx| ctx.active_dialog_id.as_ref())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(request.session_id.as_str())
            .to_owned();

        let sanitized_result =
            Self::sanitize_tool_result_for_model(request.tool_name.as_str(), raw_result);

        let tool_payload = json!({
            "sessionId": request.session_id,
            "callId": request.call_id,
            "toolName": request.tool_name,
            "iteration": iteration,
            "args": request.args,
            "result": sanitized_result,
        });

        let saved_doc = self.host_port.tools_store_calling_doc(&json!({
            "dialogId": dialog_id,
            "sessionId": request.session_id,
            "callId": request.call_id,
            "toolName": request.tool_name,
            "iteration": iteration,
            "payload": tool_payload,
        }))
        .await
        .ok();

        let doc_id = saved_doc
            .as_ref()
            .and_then(|response| response.get("docId"))
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();

        if doc_id.is_empty() {
            return Ok(sanitized_result);
        }

        Ok(json!({
            "__toolDocId": doc_id,
            "data": sanitized_result,
        }))
    }
}
