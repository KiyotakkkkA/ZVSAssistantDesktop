use async_trait::async_trait;
use futures::Stream;
use std::pin::Pin;

use crate::domain::{
    chat::{
        ChatSessionEvent, OllamaChatChunk, RunChatSessionPayload, SessionState,
        ToolExecutionRequest,
    },
    error::CoreError,
};

#[async_trait]
pub trait LlmPort: Send + Sync {
    async fn stream_chat(
        &self,
        payload: &RunChatSessionPayload,
        messages: &[crate::domain::chat::OllamaMessage],
        state: &SessionState,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<OllamaChatChunk, CoreError>> + Send>>, CoreError>;
}

#[async_trait]
pub trait ToolExecutorPort: Send + Sync {
    async fn execute_tool(&self, request: ToolExecutionRequest) -> Result<serde_json::Value, CoreError>;
}

pub trait EventSinkPort: Send + Sync {
    fn emit(&self, event: ChatSessionEvent);
}
