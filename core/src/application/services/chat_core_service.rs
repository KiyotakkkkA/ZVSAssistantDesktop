use futures::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

use crate::application::ports::{EventSinkPort, LlmPort, ToolExecutorPort};
use crate::application::services::tool_registry_service::ToolRegistryService;
use crate::domain::chat::{
    ChatSessionEvent, OllamaMessage, ResolveCommandApprovalPayload, RunChatSessionPayload,
    SessionConfig, SessionState, ToolExecutionRequest,
};
use crate::domain::error::CoreError;

type PendingApprovals = HashMap<String, (String, oneshot::Sender<bool>)>;

#[derive(Clone)]
pub struct ChatCoreService {
    llm_port: Arc<dyn LlmPort>,
    tool_executor_port: Arc<dyn ToolExecutorPort>,
    event_sink: Arc<dyn EventSinkPort>,
    tool_registry: Arc<ToolRegistryService>,
    sessions: Arc<Mutex<HashMap<String, SessionState>>>,
    pending_approvals: Arc<Mutex<PendingApprovals>>,
}

impl ChatCoreService {
    pub fn new(
        llm_port: Arc<dyn LlmPort>,
        tool_executor_port: Arc<dyn ToolExecutorPort>,
        event_sink: Arc<dyn EventSinkPort>,
        tool_registry: Arc<ToolRegistryService>,
    ) -> Self {
        Self {
            llm_port,
            tool_executor_port,
            event_sink,
            tool_registry,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn run_chat_session(&self, payload: RunChatSessionPayload) -> Result<(), CoreError> {
        let session_id = payload.session_id.trim().to_owned();
        if session_id.is_empty() {
            return Err(CoreError::Validation("sessionId is required".to_owned()));
        }

        let config = self.resolve_session_config(&payload);
        let mut messages: Vec<OllamaMessage> = payload.messages.clone();
        let mut tool_calls_used = 0u32;
        let state = SessionState::default();

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), state.clone());
        }

        let result = self
            .run_chat_rounds(
                &session_id,
                &payload,
                &config,
                &state,
                &mut messages,
                &mut tool_calls_used,
            )
            .await;

        self.cleanup_session(&session_id).await;

        if let Err(error) = result {
            self.event_sink.emit(ChatSessionEvent::Error {
                session_id,
                message: Self::core_error_message(&error),
            });
        }

        Ok(())
    }

    pub async fn cancel_chat_session(&self, session_id: &str) -> bool {
        let state = {
            let sessions = self.sessions.lock().await;
            sessions.get(session_id).cloned()
        };

        let Some(state) = state else {
            return false;
        };

        state.cancel();
        self.resolve_session_approvals(session_id, false).await;
        true
    }

    pub async fn resolve_command_approval(
        &self,
        payload: ResolveCommandApprovalPayload,
    ) -> bool {
        let call_id = payload.call_id.trim();
        if call_id.is_empty() {
            return false;
        }

        let sender = {
            let mut approvals = self.pending_approvals.lock().await;
            approvals.remove(call_id).map(|(_, sender)| sender)
        };

        if let Some(sender) = sender {
            let _ = sender.send(payload.accepted);
            true
        } else {
            false
        }
    }

    fn resolve_session_config(&self, payload: &RunChatSessionPayload) -> SessionConfig {
        let mut config = SessionConfig::from_payload(payload);
        if config.allowed_tools.is_empty() {
            config.allowed_tools = self
                .tool_registry
                .all_tool_names()
                .into_iter()
                .collect();
        }

        for tool_name in self.tool_registry.mandatory_tool_names() {
            config.allowed_tools.insert(tool_name);
        }

        config
    }

    async fn run_chat_rounds(
        &self,
        session_id: &str,
        payload: &RunChatSessionPayload,
        config: &SessionConfig,
        state: &SessionState,
        messages: &mut Vec<OllamaMessage>,
        tool_calls_used: &mut u32,
    ) -> Result<(), CoreError> {
        while !state.is_cancelled() {
            let mut round_content = String::new();
            let mut round_thinking = String::new();
            let mut round_tool_calls = Vec::new();
            let mut round_usage: Option<(u32, u32, u32)> = None;

            let mut stream = match self.llm_port.stream_chat(payload, messages, state).await {
                Ok(stream) => stream,
                Err(CoreError::Cancelled) if state.is_cancelled() => break,
                Err(error) => return Err(error),
            };

            loop {
                let chunk_result = tokio::select! {
                    biased;
                    _ = state.cancelled() => break,
                    chunk_result = stream.next() => chunk_result,
                };

                let Some(chunk_result) = chunk_result else {
                    break;
                };

                let chunk = chunk_result?;

                if state.is_cancelled() {
                    break;
                }

                if let Some(message) = chunk.message {
                    if let Some(thinking) = Self::take_non_empty(message.thinking) {
                        round_thinking.push_str(&thinking);
                        self.event_sink.emit(ChatSessionEvent::ThinkingDelta {
                            session_id: session_id.to_owned(),
                            chunk_text: thinking,
                        });
                    }

                    if let Some(content) = Self::take_non_empty(message.content) {
                        round_content.push_str(&content);
                        self.event_sink.emit(ChatSessionEvent::ContentDelta {
                            session_id: session_id.to_owned(),
                            chunk_text: content,
                        });
                    }

                    if let Some(tool_calls) = message.tool_calls.filter(|calls| !calls.is_empty()) {
                        round_tool_calls.extend(tool_calls);
                    }
                }

                if chunk.done {
                    let prompt_tokens = chunk.prompt_eval_count.unwrap_or(0);
                    let completion_tokens = chunk.eval_count.unwrap_or(0);
                    let total_tokens = prompt_tokens.saturating_add(completion_tokens);
                    if total_tokens > 0 {
                        round_usage = Some((prompt_tokens, completion_tokens, total_tokens));
                    }
                }
            }

            if state.is_cancelled() {
                break;
            }

            if round_tool_calls.is_empty() {
                if let Some((prompt_tokens, completion_tokens, total_tokens)) = round_usage {
                    self.event_sink.emit(ChatSessionEvent::Usage {
                        session_id: session_id.to_owned(),
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                    });
                }

                self.event_sink.emit(ChatSessionEvent::Done {
                    session_id: session_id.to_owned(),
                });
                return Ok(());
            }

            messages.push(OllamaMessage {
                role: crate::domain::chat::OllamaRole::Assistant,
                content: round_content,
                thinking: Some(round_thinking),
                tool_calls: Some(round_tool_calls.clone()),
                tool_name: None,
            });

            for tool_call in round_tool_calls {
                if state.is_cancelled() {
                    break;
                }

                if *tool_calls_used >= config.max_tool_calls {
                    return Err(CoreError::ToolLimitExceeded(config.max_tool_calls));
                }

                let tool_name = tool_call.function.name.trim().to_owned();
                if !config.allowed_tools.contains(&tool_name) {
                    return Err(CoreError::ToolNotAllowed(tool_name));
                }

                let call_id = format!("{}:tool_call_{}", session_id, *tool_calls_used + 1);
                let args_value = Value::Object(tool_call.function.arguments.clone());

                self.event_sink.emit(ChatSessionEvent::ToolCall {
                    session_id: session_id.to_owned(),
                    call_id: call_id.clone(),
                    tool_name: tool_name.clone(),
                    args: args_value.clone(),
                });

                if self.tool_registry.tool_requires_confirmation(&tool_name) {
                    let approved = self.wait_tool_approval(session_id, &call_id, state).await;

                    if state.is_cancelled() {
                        break;
                    }

                    if !approved.unwrap_or(false) {
                        let result = Self::build_tool_cancelled_result(&tool_name, &args_value);

                        self.event_sink.emit(ChatSessionEvent::ToolResult {
                            session_id: session_id.to_owned(),
                            call_id,
                            tool_name: tool_name.clone(),
                            doc_id: None,
                            args: args_value,
                            result: result.clone(),
                        });

                        messages.push(OllamaMessage {
                            role: crate::domain::chat::OllamaRole::Tool,
                            content: serde_json::to_string(&result)
                                .unwrap_or_else(|_| "{}".to_owned()),
                            tool_calls: None,
                            tool_name: Some(tool_name),
                            thinking: None,
                        });

                        *tool_calls_used += 1;
                        continue;
                    }
                }

                let request = ToolExecutionRequest {
                    session_id: session_id.to_owned(),
                    call_id: call_id.clone(),
                    tool_name: tool_name.clone(),
                    args: args_value.clone(),
                    runtime_context: payload.runtime_context.clone(),
                };

                let result = match tokio::select! {
                    biased;
                    _ = state.cancelled() => Err(CoreError::Cancelled),
                    result = self.tool_executor_port.execute_tool(request) => result,
                } {
                    Ok(result) => result,
                    Err(CoreError::Cancelled) if state.is_cancelled() => break,
                    Err(error) => Self::wrap_tool_error(&tool_name, &error),
                };

                if state.is_cancelled() {
                    break;
                }

                let (result_for_ui, doc_id) = Self::extract_tool_result_payload(result);
                let result_for_event =
                    Self::build_tool_result_for_event(&tool_name, &result_for_ui, doc_id.as_deref());

                self.event_sink.emit(ChatSessionEvent::ToolResult {
                    session_id: session_id.to_owned(),
                    call_id,
                    tool_name: tool_name.clone(),
                    doc_id: doc_id.clone(),
                    args: args_value,
                    result: result_for_event,
                });

                let tool_content =
                    Self::build_tool_message_content(&tool_name, &result_for_ui, doc_id.as_deref());

                messages.push(OllamaMessage {
                    role: crate::domain::chat::OllamaRole::Tool,
                    content: tool_content,
                    tool_calls: None,
                    tool_name: Some(tool_name),
                    thinking: None,
                });

                *tool_calls_used += 1;
            }
        }

        self.event_sink.emit(ChatSessionEvent::Done {
            session_id: session_id.to_owned(),
        });
        Ok(())
    }

    fn to_tool_message(result: &Value) -> String {
        if result.is_string() {
            result.as_str().unwrap_or_default().to_owned()
        } else {
            serde_json::to_string(result).unwrap_or_else(|_| "{}".to_owned())
        }
    }

    fn take_non_empty(value: Option<String>) -> Option<String> {
        value.filter(|value| !value.is_empty())
    }

    fn normalize_non_empty(value: Option<&str>) -> Option<String> {
        value
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
    }

    fn extract_tool_result_payload(result: Value) -> (Value, Option<String>) {
        let Some(object) = result.as_object() else {
            return (result, None);
        };

        let doc_id = Self::normalize_non_empty(
            object.get("__toolDocId").and_then(Value::as_str),
        );

        let data = object.get("data").cloned();

        match (data, doc_id) {
            (Some(payload), Some(found_doc_id)) => (payload, Some(found_doc_id)),
            _ => (result, None),
        }
    }

    fn build_tool_result_for_event(
        tool_name: &str,
        raw_result: &Value,
        doc_id: Option<&str>,
    ) -> Value {
        if tool_name == "get_tools_calling" {
            Self::build_get_tools_calling_event_result(raw_result, doc_id)
        } else {
            raw_result.clone()
        }
    }

    fn build_tool_message_content(
        tool_name: &str,
        raw_result: &Value,
        doc_id: Option<&str>,
    ) -> String {
        if tool_name == "get_tools_calling" {
            let (doc_id, status, message) =
                Self::build_get_tools_calling_meta(raw_result, doc_id);

            return Self::to_tool_message(&json!({
                "docId": doc_id,
                "status": status,
                "message": message,
                "payload": raw_result,
            }));
        }

        if let Some(doc_id) = Self::normalize_non_empty(doc_id) {
            return Self::to_tool_message(&json!({
                "docId": doc_id,
                "status": "stored",
                "toolName": tool_name,
                "message": "Результат инструмента сжат и сохранен. Для полного payload вызови get_tools_calling с doc_id.",
            }));
        }

        Self::to_tool_message(raw_result)
    }

    fn build_get_tools_calling_meta(
        raw_result: &Value,
        doc_id_from_executor: Option<&str>,
    ) -> (String, String, String) {
        let doc_id = Self::normalize_non_empty(doc_id_from_executor)
            .or_else(|| {
                Self::normalize_non_empty(
                    raw_result.get("docId").and_then(Value::as_str),
                )
            })
            .unwrap_or_default();

        let status = raw_result
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("loaded")
            .to_owned();

        let message = raw_result
            .get("message")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| {
                if doc_id.is_empty() {
                    "Данные через get_tools_calling загружены".to_owned()
                } else {
                    format!("Данные по doc_id={} загружены через get_tools_calling", doc_id)
                }
            });

        (doc_id, status, message)
    }

    fn build_get_tools_calling_event_result(
        raw_result: &Value,
        doc_id_from_executor: Option<&str>,
    ) -> Value {
        let (doc_id, status, message) =
            Self::build_get_tools_calling_meta(raw_result, doc_id_from_executor);

        json!({
            "docId": doc_id,
            "status": status,
            "message": message,
        })
    }

    fn core_error_message(error: &CoreError) -> String {
        match error {
            CoreError::Validation(message)
            | CoreError::ToolNotAllowed(message)
            | CoreError::Llm(message)
            | CoreError::Tool(message)
            | CoreError::Internal(message) => message.clone(),
            CoreError::ToolLimitExceeded(limit) => {
                format!("Превышен лимит вызовов инструментов ({})", limit)
            }
            CoreError::Cancelled => "Операция отменена".to_owned(),
        }
    }

    fn wrap_tool_error(tool_name: &str, error: &CoreError) -> Value {
        let (code, status_code) = match error {
            CoreError::Validation(_) => ("validation", Some(400)),
            CoreError::ToolNotAllowed(_) => ("tool_not_allowed", Some(403)),
            CoreError::ToolLimitExceeded(_) => ("tool_limit_exceeded", Some(429)),
            CoreError::Cancelled => ("cancelled", None),
            CoreError::Llm(_) => ("llm_error", Some(502)),
            CoreError::Tool(_) => ("tool_execution_failed", Some(500)),
            CoreError::Internal(_) => ("internal", Some(500)),
        };

        json!({
            "ok": false,
            "error": {
                "toolName": tool_name,
                "code": code,
                "message": Self::core_error_message(error),
                "statusCode": status_code,
            }
        })
    }

    async fn cleanup_session(&self, session_id: &str) {
        {
            let mut sessions = self.sessions.lock().await;
            sessions.remove(session_id);
        }

        self.resolve_session_approvals(session_id, false).await;
    }

    fn build_tool_cancelled_result(tool_name: &str, args_value: &Value) -> Value {
        if tool_name == "command_exec" {
            let command = args_value
                .get("command")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let cwd = args_value
                .get("cwd")
                .and_then(Value::as_str)
                .unwrap_or_default();

            return json!({
                "status": "cancelled",
                "command": command,
                "cwd": cwd,
                "isAdmin": false,
                "reason": "Пользователь отклонил выполнение",
            });
        }

        json!({
            "status": "cancelled",
            "toolName": tool_name,
            "args": args_value,
            "reason": "Пользователь отклонил выполнение",
        })
    }

    async fn wait_tool_approval(
        &self,
        session_id: &str,
        call_id: &str,
        state: &SessionState,
    ) -> Option<bool> {
        let (sender, receiver) = oneshot::channel::<bool>();

        {
            let mut approvals = self.pending_approvals.lock().await;
            approvals.insert(call_id.to_owned(), (session_id.to_owned(), sender));
        }

        tokio::select! {
            biased;
            _ = state.cancelled() => None,
            result = receiver => result.ok(),
        }
    }

    async fn resolve_session_approvals(&self, session_id: &str, accepted: bool) {
        let senders = {
            let mut approvals = self.pending_approvals.lock().await;
            let keys = approvals
                .iter()
                .filter_map(|(call_id, (owner_session, _))| {
                    (owner_session == session_id).then(|| call_id.clone())
                })
                .collect::<Vec<_>>();

            keys.into_iter()
                .filter_map(|key| approvals.remove(&key).map(|(_, sender)| sender))
                .collect::<Vec<_>>()
        };

        for sender in senders {
            let _ = sender.send(accepted);
        }
    }
}
