use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, OnceLock};

use async_stream::try_stream;
use async_trait::async_trait;
use futures::Stream;
use futures_util::StreamExt;
use napi::bindgen_prelude::{Error, Result as NapiResult};
use napi::threadsafe_function::{
    ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi_derive::napi;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Client, Response};
use serde::Serialize;
use serde_json::{json, Value};
use tokio::fs;
use tokio::process::Command;
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

use crate::application::ports::{EventSinkPort, LlmPort};
use crate::application::services::chat_core_service::ChatCoreService;
use crate::application::services::tool_registry_service::ToolRegistryService;
use crate::domain::chat::{
    ChatRuntimeContext, ChatSessionEvent, OllamaChatChunk, OllamaMessage,
    ResolveCommandApprovalPayload, RunChatSessionPayload, ToolExecutionRequest,
};
use crate::domain::error::CoreError;
use crate::napi_ollama::{
    auth_header_by_mode, is_unauthorized, normalize_base_url,
    post_non_stream_with_auth_fallback,
};
use crate::tools::executor::{BuiltinToolHostPort, BuiltinToolsExecutor};

type PendingHostResults = HashMap<String, (String, oneshot::Sender<Value>)>;

const DEFAULT_ZVS_BASE_URL: &str = "http://localhost:8080";

#[derive(Default)]
struct NapiChatRuntime {
    services: Mutex<HashMap<String, ChatCoreService>>,
    pending_host_results: Mutex<PendingHostResults>,
}

impl NapiChatRuntime {
    async fn register_service(&self, session_id: String, service: ChatCoreService) {
        let mut services = self.services.lock().await;
        services.insert(session_id, service);
    }

    async fn remove_service(&self, session_id: &str) {
        let mut services = self.services.lock().await;
        services.remove(session_id);
    }

    async fn wait_for_host_result(
        &self,
        session_id: &str,
        request_id: &str,
    ) -> Result<Value, CoreError> {
        let (sender, receiver) = oneshot::channel::<Value>();

        {
            let mut pending = self.pending_host_results.lock().await;
            pending.insert(
                request_id.to_owned(),
                (session_id.to_owned(), sender),
            );
        }

        receiver.await.map_err(|_| CoreError::Cancelled)
    }

    async fn submit_host_result(&self, request_id: &str, result: Value) -> bool {
        let sender = {
            let mut pending = self.pending_host_results.lock().await;
            pending.remove(request_id).map(|(_, sender)| sender)
        };

        if let Some(sender) = sender {
            let _ = sender.send(result);
            true
        } else {
            false
        }
    }

    async fn cancel_pending_host_results(&self, session_id: &str) {
        let senders = {
            let mut pending = self.pending_host_results.lock().await;
            let keys = pending
                .iter()
                .filter_map(|(request_id, (owner_session_id, _))| {
                    if owner_session_id == session_id {
                        Some(request_id.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();

            let mut senders = Vec::new();
            for key in keys {
                if let Some((_, sender)) = pending.remove(&key) {
                    senders.push(sender);
                }
            }

            senders
        };

        drop(senders);
    }

    async fn cancel_session(&self, session_id: &str) -> bool {
        let service = {
            let services = self.services.lock().await;
            services.get(session_id).cloned()
        };

        let Some(service) = service else {
            return false;
        };

        self.cancel_pending_host_results(session_id).await;
        service.cancel_chat_session(session_id).await
    }

    async fn resolve_command_approval(&self, payload: ResolveCommandApprovalPayload) -> bool {
        let session_id = payload.call_id.split(':').next().unwrap_or_default().trim();

        if session_id.is_empty() {
            return false;
        }

        let service = {
            let services = self.services.lock().await;
            services.get(session_id).cloned()
        };

        let Some(service) = service else {
            return false;
        };

        service.resolve_command_approval(payload).await
    }
}

fn runtime() -> Arc<NapiChatRuntime> {
    static RUNTIME: OnceLock<Arc<NapiChatRuntime>> = OnceLock::new();

    RUNTIME
        .get_or_init(|| Arc::new(NapiChatRuntime::default()))
        .clone()
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum NativeChatCallbackPayload {
    ChatEvent { event: ChatSessionEvent },
    HostCall {
        request_id: String,
        session_id: String,
        method: String,
        args: Value,
    },
}

#[derive(Clone)]
struct JsEventSink {
    callback: ThreadsafeFunction<String, ErrorStrategy::CalleeHandled>,
}

impl JsEventSink {
    fn send_payload(&self, payload: &NativeChatCallbackPayload) {
        if let Ok(event_json) = serde_json::to_string(payload) {
            self.callback
                .call(Ok(event_json), ThreadsafeFunctionCallMode::NonBlocking);
        }
    }
}

impl EventSinkPort for JsEventSink {
    fn emit(&self, event: ChatSessionEvent) {
        self.send_payload(&NativeChatCallbackPayload::ChatEvent { event });
    }
}

#[derive(Clone)]
struct JsHostPort {
    runtime: Arc<NapiChatRuntime>,
    callback_sink: JsEventSink,
    session_id: String,
    ollama_token: String,
    ollama_base_url: String,
    telegram_id: String,
    telegram_bot_token: String,
}

impl JsHostPort {
    async fn request_host_method(&self, method: &str, args: Value) -> Result<Value, CoreError> {
        let request_id = format!("host_{}", Uuid::new_v4().simple());

        self.callback_sink
            .send_payload(&NativeChatCallbackPayload::HostCall {
                request_id: request_id.clone(),
                session_id: self.session_id.clone(),
                method: method.to_owned(),
                args,
            });

        let result = self
            .runtime
            .wait_for_host_result(&self.session_id, &request_id)
            .await?;

        if let Some(host_error) = result.get("__hostError") {
            let message = host_error
                .get("error")
                .and_then(|value| value.get("message"))
                .and_then(Value::as_str)
                .unwrap_or("Host method failed");

            return Err(CoreError::Tool(message.to_owned()));
        }

        Ok(result)
    }

    async fn post_ollama_tool(&self, endpoint: &str, payload: Value) -> Result<Value, CoreError> {
        let url = format!("{}/api/{}", self.ollama_base_url, endpoint);
        post_non_stream_with_auth_fallback(&url, self.ollama_token.trim(), &payload)
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))
    }

    fn runtime_context<'a>(request: &'a ToolExecutionRequest) -> Result<&'a ChatRuntimeContext, CoreError> {
        request
            .runtime_context
            .as_ref()
            .ok_or_else(|| CoreError::Validation("runtimeContext is required".to_owned()))
    }

    fn escape_markdown_v2(text: &str) -> String {
        let mut escaped = String::with_capacity(text.len());

        for ch in text.chars() {
            if matches!(
                ch,
                '_' | '*'
                    | '['
                    | ']'
                    | '('
                    | ')'
                    | '~'
                    | '`'
                    | '>'
                    | '#'
                    | '+'
                    | '-'
                    | '='
                    | '|'
                    | '{'
                    | '}'
                    | '.'
                    | '!'
                    | '\\'
            ) {
                escaped.push('\\');
            }

            escaped.push(ch);
        }

        escaped
    }

    fn decode_output(bytes: &[u8]) -> String {
        String::from_utf8_lossy(bytes).to_string()
    }

    fn resolved_cwd(cwd: Option<&str>) -> Result<PathBuf, CoreError> {
        match cwd.map(str::trim).filter(|value| !value.is_empty()) {
            Some(raw_cwd) => {
                let path = PathBuf::from(raw_cwd);
                if !path.exists() {
                    return Err(CoreError::Validation(format!(
                        "Рабочая директория не существует: {}",
                        raw_cwd
                    )));
                }
                Ok(path)
            }
            None => std::env::current_dir().map_err(|error| CoreError::Internal(error.to_string())),
        }
    }
}

#[async_trait]
impl BuiltinToolHostPort for JsHostPort {
    async fn exec_shell(&self, command: &str, cwd: Option<&str>) -> Result<Value, CoreError> {
        let trimmed_command = command.trim();
        if trimmed_command.is_empty() {
            return Err(CoreError::Validation(
                "Команда для выполнения не указана".to_owned(),
            ));
        }

        let resolved_cwd = Self::resolved_cwd(cwd)?;

        let output = if cfg!(windows) {
            Command::new("cmd")
                .arg("/C")
                .arg(format!("chcp 65001>nul & {}", trimmed_command))
                .current_dir(&resolved_cwd)
                .output()
                .await
        } else {
            Command::new("sh")
                .arg("-lc")
                .arg(trimmed_command)
                .current_dir(&resolved_cwd)
                .output()
                .await
        }
        .map_err(|error| CoreError::Tool(error.to_string()))?;

        Ok(json!({
            "command": trimmed_command,
            "cwd": resolved_cwd.to_string_lossy().to_string(),
            "isAdmin": false,
            "exitCode": output.status.code().unwrap_or(-1),
            "stdout": Self::decode_output(&output.stdout),
            "stderr": Self::decode_output(&output.stderr),
        }))
    }

    async fn vector_search(&self, request: &ToolExecutionRequest) -> Result<Value, CoreError> {
        let runtime_context = Self::runtime_context(request)?;
        let query = request
            .args
            .get("query")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default();

        if query.is_empty() {
            return Err(CoreError::Validation("Поисковый запрос пуст".to_owned()));
        }

        let active_project_id = runtime_context
            .active_project_id
            .as_deref()
            .map(str::trim)
            .unwrap_or_default();
        if active_project_id.is_empty() {
            return Err(CoreError::Validation(
                "vector_store_search_tool доступен только в чате проекта".to_owned(),
            ));
        }

        let vector_storage_id = runtime_context
            .project_vector_storage_id
            .as_deref()
            .map(str::trim)
            .unwrap_or_default();
        if vector_storage_id.is_empty() {
            return Err(CoreError::Validation(
                "К текущему проекту не подключено векторное хранилище".to_owned(),
            ));
        }

        let top_k = request
            .args
            .get("limit")
            .or_else(|| request.args.get("topK"))
            .and_then(Value::as_u64)
            .unwrap_or(5)
            .clamp(1, 10);
        let token = runtime_context
            .zvs_access_token
            .as_deref()
            .map(str::trim)
            .unwrap_or_default();
        let base_url = runtime_context
            .zvs_base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_ZVS_BASE_URL)
            .trim_end_matches('/');

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if !token.is_empty() {
            let auth_header = HeaderValue::from_str(&format!("Bearer {}", token))
                .map_err(|error| CoreError::Internal(error.to_string()))?;
            headers.insert(AUTHORIZATION, auth_header);
        }

        let response = Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|error| CoreError::Tool(error.to_string()))?
            .post(format!(
                "{}/api/vstorages/{}/search",
                base_url, vector_storage_id
            ))
            .json(&json!({ "query": query, "topK": top_k }))
            .send()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        let status = response.status();
        let body_text = response
            .text()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        if !status.is_success() {
            return Err(CoreError::Tool(if body_text.trim().is_empty() {
                format!("Request failed with status {}", status.as_u16())
            } else {
                body_text
            }));
        }

        let parsed = if body_text.trim().is_empty() {
            json!({ "items": [] })
        } else {
            serde_json::from_str::<Value>(&body_text)
                .map_err(|error| CoreError::Tool(error.to_string()))?
        };

        let items = parsed
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let hits = items
            .iter()
            .map(|item| {
                json!({
                    "id": item.get("id").and_then(Value::as_str).unwrap_or_default(),
                    "text": item.get("document").and_then(Value::as_str).unwrap_or_default(),
                    "score": item.get("distance").and_then(Value::as_f64).unwrap_or(f64::NAN),
                })
            })
            .collect::<Vec<_>>();

        Ok(json!({
            "vectorStorageId": vector_storage_id,
            "items": items,
            "hits": hits,
            "request": {
                "query": query,
                "topK": top_k,
                "storageId": vector_storage_id,
                "projectId": active_project_id,
            }
        }))
    }

    async fn web_search(&self, query: &str) -> Result<Value, CoreError> {
        self.post_ollama_tool("web_search", json!({ "query": query }))
            .await
    }

    async fn web_fetch(&self, url: &str) -> Result<Value, CoreError> {
        self.post_ollama_tool("web_fetch", json!({ "url": url }))
            .await
    }

    async fn browser_open_url(&self, args: &Value) -> Result<Value, CoreError> {
        self.request_host_method("browser.open_url", args.clone()).await
    }

    async fn browser_snapshot(&self, args: &Value) -> Result<Value, CoreError> {
        self.request_host_method("browser.get_page_snapshot", args.clone())
            .await
    }

    async fn browser_interact(&self, args: &Value) -> Result<Value, CoreError> {
        self.request_host_method("browser.interact", args.clone()).await
    }

    async fn browser_close(&self) -> Result<Value, CoreError> {
        self.request_host_method("browser.close", json!({})).await
    }

    async fn telegram_send(&self, args: &Value) -> Result<Value, CoreError> {
        let telegram_id = args
            .get("telegramId")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or(self.telegram_id.as_str());
        let telegram_bot_token = args
            .get("telegramBotToken")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or(self.telegram_bot_token.as_str());

        if telegram_id.is_empty() || telegram_bot_token.is_empty() {
            return Ok(json!({
                "success": false,
                "error": "missing_config",
                "message": "Telegram не настроен. Укажи Bot Token и ID пользователя в настройках.",
            }));
        }

        let message = args.get("message").and_then(Value::as_str).unwrap_or_default();
        let parse_mode = match args.get("parse_mode").and_then(Value::as_str) {
            Some("HTML") => "HTML",
            Some("MarkdownV2") => "MarkdownV2",
            _ => "Markdown",
        };
        let text = if parse_mode == "MarkdownV2" {
            Self::escape_markdown_v2(message)
        } else {
            message.to_owned()
        };

        let response = Client::new()
            .post(format!(
                "https://api.telegram.org/bot{}/sendMessage",
                telegram_bot_token
            ))
            .json(&json!({
                "chat_id": telegram_id,
                "text": text,
                "parse_mode": parse_mode,
            }))
            .send()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;
        let parsed = response
            .json::<Value>()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        if !parsed.get("ok").and_then(Value::as_bool).unwrap_or(false) {
            return Ok(json!({
                "success": false,
                "error": parsed.get("description").and_then(Value::as_str).unwrap_or("unknown"),
                "message": "failed",
            }));
        }

        Ok(json!({
            "success": true,
            "message": "sent",
            "message_id": parsed
                .get("result")
                .and_then(|value| value.get("message_id"))
                .and_then(Value::as_u64),
        }))
    }

    async fn telegram_unread(&self, args: &Value) -> Result<Value, CoreError> {
        let telegram_id = args
            .get("telegramId")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or(self.telegram_id.as_str());
        let telegram_bot_token = args
            .get("telegramBotToken")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or(self.telegram_bot_token.as_str());

        if telegram_id.is_empty() || telegram_bot_token.is_empty() {
            return Ok(json!({
                "success": false,
                "error": "missing_config",
                "message": "Telegram не настроен. Укажи Bot Token и ID пользователя в настройках.",
            }));
        }

        let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(20).clamp(1, 100);
        let mark_as_read = args
            .get("mark_as_read")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        let offset = 0u64;

        let response = Client::new()
            .post(format!(
                "https://api.telegram.org/bot{}/getUpdates",
                telegram_bot_token
            ))
            .json(&json!({
                "offset": offset,
                "limit": limit,
                "timeout": 0,
                "allowed_updates": ["message"],
            }))
            .send()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;
        let parsed = response
            .json::<Value>()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        if !parsed.get("ok").and_then(Value::as_bool).unwrap_or(false) {
            return Ok(json!({
                "success": false,
                "error": parsed.get("description").and_then(Value::as_str).unwrap_or("unknown"),
                "message": "failed",
            }));
        }

        let updates = parsed
            .get("result")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let next_offset = updates
            .iter()
            .filter_map(|item| item.get("update_id").and_then(Value::as_u64))
            .max()
            .map(|value| value + 1)
            .unwrap_or(offset);

        if mark_as_read && next_offset > 0 {
            let _ = Client::new()
                .post(format!(
                    "https://api.telegram.org/bot{}/getUpdates",
                    telegram_bot_token
                ))
                .json(&json!({
                    "offset": next_offset,
                    "limit": 1,
                    "timeout": 0,
                    "allowed_updates": ["message"],
                }))
                .send()
                .await;
        }

        let messages = updates
            .iter()
            .filter(|update| {
                update
                    .get("message")
                    .and_then(|message| message.get("chat"))
                    .and_then(|chat| chat.get("id"))
                    .map(|chat_id| match chat_id {
                        Value::String(value) => value == telegram_id,
                        Value::Number(value) => value.to_string() == telegram_id,
                        _ => false,
                    })
                    .unwrap_or(false)
            })
            .map(|update| {
                json!({
                    "update_id": update.get("update_id").and_then(Value::as_u64),
                    "message_id": update.get("message").and_then(|message| message.get("message_id")).and_then(Value::as_u64),
                    "date": update.get("message").and_then(|message| message.get("date")).and_then(Value::as_u64),
                    "text": update.get("message").and_then(|message| message.get("text")).and_then(Value::as_str).unwrap_or_default(),
                    "chat": update.get("message").and_then(|message| message.get("chat")).cloned().unwrap_or_else(|| json!({})),
                    "from": update.get("message").and_then(|message| message.get("from")).cloned().unwrap_or_else(|| json!({})),
                })
            })
            .collect::<Vec<_>>();

        Ok(json!({
            "success": true,
            "message": "ok",
            "unread_count": messages.len(),
            "updates_count": updates.len(),
            "offset_used": offset,
            "next_offset": if mark_as_read { next_offset } else { offset },
            "messages": messages,
        }))
    }

    async fn fs_list_directory(&self, cwd: &str) -> Result<Value, CoreError> {
        let mut dir = fs::read_dir(cwd)
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;
        let mut entries = Vec::new();

        while let Some(entry) = dir
            .next_entry()
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?
        {
            let metadata = entry
                .metadata()
                .await
                .map_err(|error| CoreError::Tool(error.to_string()))?;
            let modified_at = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|value| value.as_secs().to_string())
                .unwrap_or_default();

            entries.push(json!({
                "name": entry.file_name().to_string_lossy().to_string(),
                "type": if metadata.is_dir() { "directory" } else { "file" },
                "size": metadata.len(),
                "modifiedAt": modified_at,
            }));
        }

        Ok(json!({ "path": cwd, "entries": entries }))
    }

    async fn fs_create_file(&self, cwd: &str, filename: &str, content: &str) -> Result<Value, CoreError> {
        let file_path = Path::new(cwd).join(filename);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|error| CoreError::Tool(error.to_string()))?;
        }

        fs::write(&file_path, content)
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        Ok(json!({
            "success": true,
            "path": file_path.to_string_lossy().to_string(),
        }))
    }

    async fn fs_create_dir(&self, cwd: &str, dirname: &str) -> Result<Value, CoreError> {
        let dir_path = Path::new(cwd).join(dirname);
        fs::create_dir_all(&dir_path)
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;

        Ok(json!({
            "success": true,
            "path": dir_path.to_string_lossy().to_string(),
        }))
    }

    async fn fs_read_file(
        &self,
        file_path: &str,
        read_all: bool,
        from_row: Option<u32>,
        to_row: Option<u32>,
    ) -> Result<Value, CoreError> {
        let raw = fs::read_to_string(file_path)
            .await
            .map_err(|error| CoreError::Tool(error.to_string()))?;
        let lines = raw.split('\n').collect::<Vec<_>>();
        let total_lines = lines.len() as u32;

        if read_all {
            return Ok(json!({
                "path": file_path,
                "content": raw,
                "totalLines": total_lines,
                "fromLine": 1,
                "toLine": total_lines,
            }));
        }

        let from_line = from_row.unwrap_or(1).max(1);
        let to_line = to_row.unwrap_or(total_lines).min(total_lines.max(1));
        let content = if total_lines == 0 {
            String::new()
        } else {
            lines[(from_line as usize - 1)..to_line as usize].join("\n")
        };

        Ok(json!({
            "path": file_path,
            "content": content,
            "totalLines": total_lines,
            "fromLine": from_line,
            "toLine": to_line,
        }))
    }

}

#[derive(Clone)]
struct OllamaHttpLlmPort {
    token: String,
    base_url: String,
    tool_registry: Arc<ToolRegistryService>,
}

impl OllamaHttpLlmPort {
    fn resolve_tool_names(payload: &RunChatSessionPayload) -> Vec<String> {
        match &payload.enabled_tool_names {
            Some(names) if !names.is_empty() => names.clone(),
            _ => crate::tools::builtin_tools::builtin_tool_definitions()
                .into_iter()
                .map(|tool| tool.function.name)
                .collect(),
        }
    }

    fn build_chat_payload(
        &self,
        payload: &RunChatSessionPayload,
        messages: &[OllamaMessage],
    ) -> Result<Value, CoreError> {
        let tool_names = Self::resolve_tool_names(payload);
        let tool_definitions = self.tool_registry.resolve_enabled(&tool_names);

        let mut request_payload = json!({
            "model": payload.model,
            "messages": messages,
            "stream": true,
        });

        let Some(object) = request_payload.as_object_mut() else {
            return Err(CoreError::Internal(
                "failed to construct chat payload".to_owned(),
            ));
        };

        if !tool_definitions.is_empty() {
            object.insert(
                "tools".to_owned(),
                serde_json::to_value(tool_definitions)
                    .map_err(|error| CoreError::Internal(error.to_string()))?,
            );
        }

        if let Some(format) = &payload.format {
            object.insert(
                "format".to_owned(),
                serde_json::to_value(format)
                    .map_err(|error| CoreError::Internal(error.to_string()))?,
            );
        }

        if let Some(think) = payload.think {
            object.insert("think".to_owned(), Value::Bool(think));
        }

        Ok(request_payload)
    }

    async fn open_streaming_response(
        &self,
        endpoint_url: &str,
        body_value: &Value,
    ) -> Result<Response, CoreError> {
        let modes = if self.token.trim().is_empty() {
            vec!["none"]
        } else {
            vec!["bearer", "raw", "none"]
        };
        let mut last_error = String::new();

        for mode in modes {
            let mut headers = HeaderMap::new();
            headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

            if let Some(auth) = auth_header_by_mode(&self.token, mode) {
                if let Ok(value) = HeaderValue::from_str(&auth) {
                    headers.insert(AUTHORIZATION, value);
                }
            }

            let client = Client::builder()
                .default_headers(headers)
                .build()
                .map_err(|error| CoreError::Llm(error.to_string()))?;

            let response = match client.post(endpoint_url).json(body_value).send().await {
                Ok(response) => response,
                Err(error) => {
                    last_error = error.to_string();
                    continue;
                }
            };

            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.unwrap_or_default();
                if is_unauthorized(Some(status), &text) {
                    last_error = text;
                    continue;
                }

                return Err(CoreError::Llm(if text.trim().is_empty() {
                    format!("Request failed ({})", status)
                } else {
                    text
                }));
            }

            return Ok(response);
        }

        Err(CoreError::Llm(if last_error.is_empty() {
            "Ollama auth failed".to_owned()
        } else {
            format!("Ollama auth failed: {}", last_error)
        }))
    }
}

#[async_trait]
impl LlmPort for OllamaHttpLlmPort {
    async fn stream_chat(
        &self,
        payload: &RunChatSessionPayload,
        messages: &[OllamaMessage],
    ) -> Result<Pin<Box<dyn Stream<Item = Result<OllamaChatChunk, CoreError>> + Send>>, CoreError>
    {
        let request_payload = self.build_chat_payload(payload, messages)?;
        let endpoint_url = format!("{}/api/chat", self.base_url);
        let response = self
            .open_streaming_response(&endpoint_url, &request_payload)
            .await?;
        let token = self.token.clone();
        let stream_request_payload = request_payload.clone();

        let stream = try_stream! {
            let mut buffer = String::new();
            let mut bytes_stream = response.bytes_stream();
            let mut got_done = false;

            'outer: while let Some(chunk_result) = bytes_stream.next().await {
                let bytes = chunk_result.map_err(|error| CoreError::Llm(error.to_string()))?;
                buffer.push_str(&String::from_utf8_lossy(&bytes));

                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].trim().to_owned();
                    buffer.drain(..=pos);

                    if line.is_empty() {
                        continue;
                    }

                    let parsed = serde_json::from_str::<OllamaChatChunk>(&line)
                        .map_err(|error| CoreError::Llm(format!("Stream JSON error: {}", error)))?;

                    if parsed.done {
                        got_done = true;
                    }

                    let is_done = parsed.done;
                    yield parsed;

                    if is_done {
                        break 'outer;
                    }
                }
            }

            let rest = buffer.trim().to_owned();
            if !got_done && !rest.is_empty() {
                let parsed = serde_json::from_str::<OllamaChatChunk>(&rest)
                    .map_err(|error| CoreError::Llm(format!("Stream JSON error: {}", error)))?;

                if parsed.done {
                    got_done = true;
                }

                yield parsed;
            }

            if !got_done {
                let mut fallback_payload = stream_request_payload.clone();
                if let Some(object) = fallback_payload.as_object_mut() {
                    object.insert("stream".to_owned(), Value::Bool(false));
                }

                let fallback = post_non_stream_with_auth_fallback(
                    &endpoint_url,
                    token.trim(),
                    &fallback_payload,
                )
                .await
                .map_err(|error| CoreError::Llm(error.to_string()))?;

                let parsed = serde_json::from_value::<OllamaChatChunk>(fallback)
                    .map_err(|error| CoreError::Llm(format!("Invalid JSON: {}", error)))?;
                yield parsed;
            }
        };

        Ok(Box::pin(stream))
    }
}

#[napi(js_name = "runChatSessionCore")]
pub async fn run_chat_session_core(
    payload_json: String,
    token: String,
    base_url: Option<String>,
    #[napi(ts_arg_type = "(err: null | Error, event: string) => void")]
    callback: ThreadsafeFunction<String, ErrorStrategy::CalleeHandled>,
) -> NapiResult<()> {
    let payload: RunChatSessionPayload = serde_json::from_str(&payload_json)
        .map_err(|error| Error::from_reason(format!("Invalid payload JSON: {}", error)))?;
    let session_id = payload.session_id.trim().to_owned();
    let normalized_base_url = normalize_base_url(base_url);
    let runtime_context = payload.runtime_context.clone();

    if session_id.is_empty() {
        return Err(Error::from_reason("sessionId is required".to_owned()));
    }

    let runtime = runtime();
    let tool_registry = Arc::new(ToolRegistryService::new());
    let callback_sink = JsEventSink {
        callback: callback.clone(),
    };
    let service = ChatCoreService::new(
        Arc::new(OllamaHttpLlmPort {
            token: token.trim().to_owned(),
            base_url: normalized_base_url.clone(),
            tool_registry: tool_registry.clone(),
        }),
        Arc::new(BuiltinToolsExecutor::new(Arc::new(JsHostPort {
            runtime: runtime.clone(),
            callback_sink,
            session_id: session_id.clone(),
            ollama_token: token.trim().to_owned(),
            ollama_base_url: normalized_base_url,
            telegram_id: runtime_context
                .as_ref()
                .and_then(|ctx| ctx.telegram_id.clone())
                .unwrap_or_default(),
            telegram_bot_token: runtime_context
                .as_ref()
                .and_then(|ctx| ctx.telegram_bot_token.clone())
                .unwrap_or_default(),
        }))),
        Arc::new(JsEventSink { callback }),
        tool_registry,
    );

    runtime
        .register_service(session_id.clone(), service.clone())
        .await;

    let result = service.run_chat_session(payload).await;

    runtime.remove_service(&session_id).await;
    runtime.cancel_pending_host_results(&session_id).await;

    result.map_err(|error| Error::from_reason(error.to_string()))
}

#[napi(js_name = "cancelChatSessionCore")]
pub async fn cancel_chat_session_core(session_id: String) -> NapiResult<bool> {
    Ok(runtime().cancel_session(session_id.trim()).await)
}

#[napi(js_name = "resolveCommandApprovalCore")]
pub async fn resolve_command_approval_core(payload_json: String) -> NapiResult<bool> {
    let payload = serde_json::from_str::<ResolveCommandApprovalPayload>(&payload_json)
        .map_err(|error| Error::from_reason(format!("Invalid payload JSON: {}", error)))?;

    Ok(runtime().resolve_command_approval(payload).await)
}

#[napi(js_name = "submitToolResult")]
pub async fn submit_tool_result(call_id: String, result_json: String) -> NapiResult<bool> {
    let call_id = call_id.trim().to_owned();

    if call_id.is_empty() {
        return Ok(false);
    }

    let result = serde_json::from_str::<Value>(&result_json)
        .unwrap_or_else(|_| Value::String(result_json));

    Ok(runtime().submit_host_result(&call_id, result).await)
}