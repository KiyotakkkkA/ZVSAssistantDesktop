use crate::application::services::tool_registry_service::ToolRegistryService;
use crate::domain::chat::OllamaToolDefinition;

#[derive(Clone)]
pub struct GetBuiltinToolsUseCase {
    tool_registry: ToolRegistryService,
}

impl GetBuiltinToolsUseCase {
    pub fn new(tool_registry: ToolRegistryService) -> Self {
        Self { tool_registry }
    }

    pub fn execute(&self, enabled_tool_names: &[String]) -> Vec<OllamaToolDefinition> {
        self.tool_registry.resolve_enabled(enabled_tool_names)
    }
}

#[derive(Clone)]
pub struct GetBuiltinToolNamesUseCase {
    tool_registry: ToolRegistryService,
}

impl GetBuiltinToolNamesUseCase {
    pub fn new(tool_registry: ToolRegistryService) -> Self {
        Self { tool_registry }
    }

    pub fn execute(&self) -> Vec<String> {
        self.tool_registry.all_tool_names()
    }
}
