use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashSet};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::Notify;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRuntimeContext {
    pub active_dialog_id: Option<String>,
    pub active_project_id: Option<String>,
    pub project_directory: Option<String>,
    pub project_vector_storage_id: Option<String>,
    pub current_date: Option<String>,
    pub zvs_access_token: Option<String>,
    pub zvs_base_url: Option<String>,
    pub telegram_id: Option<String>,
    pub telegram_bot_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunChatSessionPayload {
    pub session_id: String,
    pub model: String,
    pub messages: Vec<OllamaMessage>,
    pub tools: Option<Vec<OllamaToolDefinition>>,
    pub enabled_tool_names: Option<Vec<String>>,
    pub format: Option<OllamaResponseFormat>,
    pub think: Option<bool>,
    pub max_tool_calls: Option<u32>,
    #[serde(default)]
    pub use_auto_tool_calling_confirmation: bool,
    pub agent_mode: Option<String>,
    pub runtime_context: Option<ChatRuntimeContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveCommandApprovalPayload {
    pub call_id: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatSessionEvent {
    #[serde(rename = "thinking.delta")]
    ThinkingDelta {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "chunkText")]
        chunk_text: String,
    },
    #[serde(rename = "content.delta")]
    ContentDelta {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "chunkText")]
        chunk_text: String,
    },
    #[serde(rename = "tool.call")]
    ToolCall {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "callId")]
        call_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        args: Value,
    },
    #[serde(rename = "tool.result")]
    ToolResult {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "callId")]
        call_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        #[serde(rename = "docId", skip_serializing_if = "Option::is_none")]
        doc_id: Option<String>,
        args: Value,
        result: Value,
    },
    #[serde(rename = "usage")]
    Usage {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "promptTokens")]
        prompt_tokens: u32,
        #[serde(rename = "completionTokens")]
        completion_tokens: u32,
        #[serde(rename = "totalTokens")]
        total_tokens: u32,
    },
    #[serde(rename = "done")]
    Done {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "error")]
    Error {
        #[serde(rename = "sessionId")]
        session_id: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OllamaRole {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
    pub role: OllamaRole,
    pub content: String,
    pub tool_calls: Option<Vec<OllamaToolCall>>,
    pub tool_name: Option<String>,
    pub thinking: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCall {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub function: OllamaToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCallFunction {
    pub index: Option<u32>,
    pub name: String,
    pub arguments: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolDefinition {
    #[serde(rename = "type")]
    pub kind: String,
    pub function: OllamaToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolFunction {
    pub name: String,
    pub description: Option<String>,
    pub parameters: ToolParameterSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolParameterSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    pub description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
    pub properties: Option<BTreeMap<String, ToolParameterSchema>>,
    pub items: Option<Box<ToolParameterSchema>>,
    pub required: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OllamaResponseFormat {
    JsonKeyword(String),
    JsonSchema(Value),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaChatChunk {
    pub message: Option<OllamaChunkMessage>,
    pub done: bool,
    pub prompt_eval_count: Option<u32>,
    pub eval_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaChunkMessage {
    pub content: Option<String>,
    pub thinking: Option<String>,
    pub tool_calls: Option<Vec<OllamaToolCall>>,
}

#[derive(Debug, Clone)]
pub struct SessionState {
    cancelled: Arc<AtomicBool>,
    cancel_notify: Arc<Notify>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            cancel_notify: Arc::new(Notify::new()),
        }
    }
}

impl SessionState {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        self.cancel_notify.notify_waiters();
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    pub async fn cancelled(&self) {
        if self.is_cancelled() {
            return;
        }

        self.cancel_notify.notified().await;
    }
}

#[derive(Debug, Clone)]
pub struct ToolExecutionRequest {
    pub session_id: String,
    pub call_id: String,
    pub tool_name: String,
    pub args: Value,
    pub runtime_context: Option<ChatRuntimeContext>,
}

#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub allowed_tools: HashSet<String>,
    pub max_tool_calls: u32,
    pub use_auto_tool_calling_confirmation: bool,
}

impl SessionConfig {
    pub fn from_payload(payload: &RunChatSessionPayload) -> Self {
        let mut allowed_tools = HashSet::new();

        if let Some(explicit) = &payload.enabled_tool_names {
            for name in explicit {
                if !name.trim().is_empty() {
                    allowed_tools.insert(name.trim().to_owned());
                }
            }
        } else if let Some(tools) = &payload.tools {
            for tool in tools {
                let name = tool.function.name.trim();
                if !name.is_empty() {
                    allowed_tools.insert(name.to_owned());
                }
            }
        }

        Self {
            allowed_tools,
            max_tool_calls: payload.max_tool_calls.unwrap_or(1).max(1),
            use_auto_tool_calling_confirmation: payload.use_auto_tool_calling_confirmation,
        }
    }
}
