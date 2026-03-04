use futures::StreamExt;
use serde_json::Value;
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

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), SessionState::default());
        }

        let result = self
            .run_chat_rounds(
                &session_id,
                &payload,
                &config,
                &mut messages,
                &mut tool_calls_used,
            )
            .await;

        self.cleanup_session(&session_id).await;
        result
    }

    pub async fn cancel_chat_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.lock().await;
        let Some(state) = sessions.get_mut(session_id) else {
            return false;
        };

        state.cancelled = true;
        drop(sessions);
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
        config
    }

    async fn run_chat_rounds(
        &self,
        session_id: &str,
        payload: &RunChatSessionPayload,
        config: &SessionConfig,
        messages: &mut Vec<OllamaMessage>,
        tool_calls_used: &mut u32,
    ) -> Result<(), CoreError> {
        while !self.is_cancelled(session_id).await {
            let mut round_content = String::new();
            let mut round_thinking = String::new();
            let mut round_tool_calls = Vec::new();
            let mut round_usage: Option<(u32, u32, u32)> = None;

            let mut stream = self.llm_port.stream_chat(payload, messages).await?;

            while let Some(chunk_result) = stream.next().await {
                let chunk = chunk_result?;

                if self.is_cancelled(session_id).await {
                    break;
                }

                if let Some(message) = chunk.message {
                    if let Some(thinking) = message.thinking {
                        if !thinking.is_empty() {
                            round_thinking.push_str(&thinking);
                            self.event_sink.emit(ChatSessionEvent::ThinkingDelta {
                                session_id: session_id.to_owned(),
                                chunk_text: thinking,
                            });
                        }
                    }

                    if let Some(content) = message.content {
                        if !content.is_empty() {
                            round_content.push_str(&content);
                            self.event_sink.emit(ChatSessionEvent::ContentDelta {
                                session_id: session_id.to_owned(),
                                chunk_text: content,
                            });
                        }
                    }

                    if let Some(tool_calls) = message.tool_calls {
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

            if self.is_cancelled(session_id).await {
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
                if self.is_cancelled(session_id).await {
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

                if tool_name == "command_exec" {
                    let approved = self
                        .wait_command_approval(session_id, &call_id)
                        .await
                        .unwrap_or(false);

                    if !approved {
                        let command = args_value
                            .get("command")
                            .and_then(Value::as_str)
                            .unwrap_or_default();
                        let cwd = args_value
                            .get("cwd")
                            .and_then(Value::as_str)
                            .unwrap_or_default();

                        let result = serde_json::json!({
                            "status": "cancelled",
                            "command": command,
                            "cwd": cwd,
                            "isAdmin": false,
                            "reason": "Пользователь отклонил выполнение",
                        });

                        self.event_sink.emit(ChatSessionEvent::ToolResult {
                            session_id: session_id.to_owned(),
                            call_id,
                            tool_name: tool_name.clone(),
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

                let result = self
                    .tool_executor_port
                    .execute_tool(ToolExecutionRequest {
                        session_id: session_id.to_owned(),
                        call_id: call_id.clone(),
                        tool_name: tool_name.clone(),
                        args: args_value.clone(),
                        runtime_context: payload.runtime_context.clone(),
                    })
                    .await?;

                self.event_sink.emit(ChatSessionEvent::ToolResult {
                    session_id: session_id.to_owned(),
                    call_id,
                    tool_name: tool_name.clone(),
                    args: args_value,
                    result: result.clone(),
                });

                messages.push(OllamaMessage {
                    role: crate::domain::chat::OllamaRole::Tool,
                    content: if result.is_string() {
                        result.as_str().unwrap_or_default().to_owned()
                    } else {
                        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_owned())
                    },
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

    async fn is_cancelled(&self, session_id: &str) -> bool {
        let sessions = self.sessions.lock().await;
        sessions.get(session_id).map(|state| state.cancelled).unwrap_or(false)
    }

    async fn cleanup_session(&self, session_id: &str) {
        {
            let mut sessions = self.sessions.lock().await;
            sessions.remove(session_id);
        }

        self.resolve_session_approvals(session_id, false).await;
    }

    async fn wait_command_approval(&self, session_id: &str, call_id: &str) -> Option<bool> {
        let (sender, receiver) = oneshot::channel::<bool>();

        {
            let mut approvals = self.pending_approvals.lock().await;
            approvals.insert(call_id.to_owned(), (session_id.to_owned(), sender));
        }

        receiver.await.ok()
    }

    async fn resolve_session_approvals(&self, session_id: &str, accepted: bool) {
        let senders = {
            let mut approvals = self.pending_approvals.lock().await;
            let mut keys = Vec::new();
            for (call_id, (owner_session, _)) in approvals.iter() {
                if owner_session == session_id {
                    keys.push(call_id.clone());
                }
            }

            let mut pending = Vec::new();
            for key in keys {
                if let Some((_, sender)) = approvals.remove(&key) {
                    pending.push(sender);
                }
            }
            pending
        };

        for sender in senders {
            let _ = sender.send(accepted);
        }
    }
}
