#![deny(clippy::all)]

pub mod application;
pub mod domain;
pub mod napi_ollama;
pub mod tools;

pub use application::services::chat_core_service::ChatCoreService;
pub use application::services::tool_registry_service::ToolRegistryService;
pub use domain::chat::{ResolveCommandApprovalPayload, RunChatSessionPayload};
pub use domain::error::CoreError;
