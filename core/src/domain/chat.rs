use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRuntimeContext {
    pub active_project_id: Option<String>,
    pub project_directory: Option<String>,
    pub current_date: Option<String>,
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
        session_id: String,
        chunk_text: String,
    },
    #[serde(rename = "content.delta")]
    ContentDelta {
        session_id: String,
        chunk_text: String,
    },
    #[serde(rename = "tool.call")]
    ToolCall {
        session_id: String,
        call_id: String,
        tool_name: String,
        args: Value,
    },
    #[serde(rename = "tool.result")]
    ToolResult {
        session_id: String,
        call_id: String,
        tool_name: String,
        args: Value,
        result: Value,
    },
    #[serde(rename = "usage")]
    Usage {
        session_id: String,
        prompt_tokens: u32,
        completion_tokens: u32,
        total_tokens: u32,
    },
    #[serde(rename = "done")]
    Done { session_id: String },
    #[serde(rename = "error")]
    Error { session_id: String, message: String },
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
#[serde(rename_all = "camelCase")]
pub struct OllamaMessage {
    pub role: OllamaRole,
    pub content: String,
    pub tool_calls: Option<Vec<OllamaToolCall>>,
    pub tool_name: Option<String>,
    pub thinking: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaToolCall {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub function: OllamaToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaToolCallFunction {
    pub index: Option<u32>,
    pub name: String,
    pub arguments: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaToolDefinition {
    #[serde(rename = "type")]
    pub kind: String,
    pub function: OllamaToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaToolFunction {
    pub name: String,
    pub description: Option<String>,
    pub parameters: ToolParameterSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Default)]
pub struct SessionState {
    pub cancelled: bool,
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
        }
    }
}
