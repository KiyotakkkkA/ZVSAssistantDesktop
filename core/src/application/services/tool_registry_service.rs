use std::collections::{HashMap, HashSet};

use crate::domain::chat::OllamaToolDefinition;
use crate::tools::builtin_tools::builtin_tool_packages;

#[derive(Debug, Clone)]
pub struct ToolRegistryService {
    by_name: HashMap<String, OllamaToolDefinition>,
    requires_confirmation: HashSet<String>,
}

impl Default for ToolRegistryService {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistryService {
    pub fn new() -> Self {
        let mut by_name = HashMap::new();
        let mut requires_confirmation = HashSet::new();

        for package in builtin_tool_packages() {
            for descriptor in package.tools {
                let definition = descriptor.schema;
                let tool_name = definition.function.name.clone();

                if descriptor.confirmation.is_some() {
                    requires_confirmation.insert(tool_name.clone());
                }

                by_name.insert(tool_name, definition);
            }
        }

        Self {
            by_name,
            requires_confirmation,
        }
    }

    pub fn has_tool(&self, name: &str) -> bool {
        self.by_name.contains_key(name)
    }

    pub fn all_tool_names(&self) -> Vec<String> {
        let mut names: Vec<String> = self.by_name.keys().cloned().collect();
        names.sort();
        names
    }

    pub fn all_definitions(&self) -> Vec<OllamaToolDefinition> {
        self.resolve_enabled(&self.all_tool_names())
    }

    pub fn resolve_enabled(&self, enabled_names: &[String]) -> Vec<OllamaToolDefinition> {
        let enabled: HashSet<&str> = enabled_names.iter().map(String::as_str).collect();
        let mut list: Vec<OllamaToolDefinition> = self
            .by_name
            .values()
            .filter(|definition| enabled.contains(definition.function.name.as_str()))
            .cloned()
            .collect();

        list.sort_by(|a, b| a.function.name.cmp(&b.function.name));
        list
    }

    pub fn required_tools_instruction(&self, required_tool_names: &[String]) -> Option<String> {
        let mut known: Vec<String> = required_tool_names
            .iter()
            .filter(|name| self.by_name.contains_key(name.as_str()))
            .cloned()
            .collect();

        known.sort();
        known.dedup();

        if known.is_empty() {
            return None;
        }

        Some(format!(
            "You must use these tools while completing task: TOOLS - {}",
            known.join(", ")
        ))
    }

    pub fn tool_requires_confirmation(&self, tool_name: &str) -> bool {
        self.requires_confirmation.contains(tool_name)
    }
}
