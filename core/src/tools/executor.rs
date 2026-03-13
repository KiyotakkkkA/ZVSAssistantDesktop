use async_trait::async_trait;
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::application::ports::ToolExecutorPort;
use crate::domain::chat::ToolExecutionRequest;
use crate::domain::error::CoreError;
use crate::tools::packs::studying_pack::fetch_mirea_schedule_by_date;

#[async_trait]
pub trait BuiltinToolHostPort: Send + Sync {
    async fn exec_shell(&self, command: &str, cwd: Option<&str>) -> Result<Value, CoreError>;
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

    pub fn new(host_port: Arc<dyn BuiltinToolHostPort>) -> Self {
        Self {
            host_port,
            plan_store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn execute_command_exec(&self, args: &Value) -> Result<Value, CoreError> {
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

        self.host_port.exec_shell(command, cwd).await
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
            "command_exec" => self.execute_command_exec(&args).await,
            "vector_store_search_tool" => self.host_port.vector_search(&request).await,
            "web_search" => self.execute_web_search(&args).await,
            "web_fetch" => self.execute_web_fetch(&args).await,
            "open_url" => self.host_port.browser_open_url(&args).await,
            "get_page_snapshot" => self.host_port.browser_snapshot(&args).await,
            "interact_with" => self.host_port.browser_interact(&args).await,
            "interract_with" => self.host_port.browser_interact(&args).await,
            "close_browser" => self.host_port.browser_close().await,
            "send_telegram_msg" => self.host_port.telegram_send(&args).await,
            "get_telegram_unread_msgs" => self.host_port.telegram_unread(&args).await,
            "list_directory" => self.execute_list_directory(&args).await,
            "create_file" => self.execute_create_file(&args).await,
            "create_dir" => self.execute_create_dir(&args).await,
            "read_file" => self.execute_read_file(&args).await,
            "delete_file" => self.execute_delete_file(&args).await,
            "text_search" => self.execute_text_search(&args).await,
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
            "planning_tool" => self.execute_planning_tool(&args).await,
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

        let tool_payload = json!({
            "sessionId": request.session_id,
            "callId": request.call_id,
            "toolName": request.tool_name,
            "iteration": iteration,
            "args": request.args,
            "result": raw_result,
        });

        let saved_doc = self.host_port.tools_store_calling_doc(&json!({
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
            return Ok(raw_result);
        }

        Ok(json!({
            "__toolDocId": doc_id,
            "data": raw_result,
        }))
    }
}
