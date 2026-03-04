use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("validation: {0}")]
    Validation(String),
    #[error("tool not allowed: {0}")]
    ToolNotAllowed(String),
    #[error("tool limit exceeded: {0}")]
    ToolLimitExceeded(u32),
    #[error("llm: {0}")]
    Llm(String),
    #[error("tool: {0}")]
    Tool(String),
    #[error("cancelled")]
    Cancelled,
    #[error("internal: {0}")]
    Internal(String),
}
