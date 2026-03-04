use crate::application::services::chat_core_service::ChatCoreService;
use crate::domain::chat::{ResolveCommandApprovalPayload, RunChatSessionPayload};
use crate::domain::error::CoreError;

#[derive(Clone)]
pub struct RunChatSessionUseCase {
    core_service: ChatCoreService,
}

impl RunChatSessionUseCase {
    pub fn new(core_service: ChatCoreService) -> Self {
        Self { core_service }
    }

    pub async fn execute(&self, payload: RunChatSessionPayload) -> Result<(), CoreError> {
        self.core_service.run_chat_session(payload).await
    }
}

#[derive(Clone)]
pub struct CancelChatSessionUseCase {
    core_service: ChatCoreService,
}

impl CancelChatSessionUseCase {
    pub fn new(core_service: ChatCoreService) -> Self {
        Self { core_service }
    }

    pub async fn execute(&self, session_id: &str) -> bool {
        self.core_service.cancel_chat_session(session_id).await
    }
}

#[derive(Clone)]
pub struct ResolveCommandApprovalUseCase {
    core_service: ChatCoreService,
}

impl ResolveCommandApprovalUseCase {
    pub fn new(core_service: ChatCoreService) -> Self {
        Self { core_service }
    }

    pub async fn execute(&self, payload: ResolveCommandApprovalPayload) -> bool {
        self.core_service.resolve_command_approval(payload).await
    }
}
