use std::collections::{HashMap, HashSet};

use crate::domain::chat::OllamaToolDefinition;
use crate::tools::builtin_tools::{builtin_tool_packages_ref, internal_tool_definitions_ref};

const MANDATORY_INTERNAL_TOOLS: [&str; 1] = ["get_tools_calling"];
const SCENARIO_BUILDER_ONLY_TOOLS: [&str; 1] = ["scenario_builder_tool"];
const SCENARIO_BUILDER_BASE_TOOLS: [&str; 2] = ["qa_tool", "planning_tool"];

#[derive(Debug, Clone)]
pub struct ToolRegistryService {
    by_name: HashMap<String, OllamaToolDefinition>,
    requires_confirmation: HashSet<String>,
    mandatory_tools: HashSet<String>,
    scenario_builder_only_tools: HashSet<String>,
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
        let mandatory_tools = MANDATORY_INTERNAL_TOOLS
            .iter()
            .map(|name| (*name).to_owned())
            .collect::<HashSet<_>>();
        let scenario_builder_only_tools = SCENARIO_BUILDER_ONLY_TOOLS
            .iter()
            .map(|name| (*name).to_owned())
            .collect::<HashSet<_>>();

        for package in builtin_tool_packages_ref() {
            for descriptor in &package.tools {
                let definition = descriptor.schema.clone();
                let tool_name = definition.function.name.clone();

                if descriptor.confirmation.is_some() {
                    requires_confirmation.insert(tool_name.clone());
                }

                by_name.insert(tool_name, definition);
            }
        }

        for definition in internal_tool_definitions_ref() {
            by_name.insert(definition.function.name.clone(), definition.clone());
        }

        Self {
            by_name,
            requires_confirmation,
            mandatory_tools,
            scenario_builder_only_tools,
        }
    }

    pub fn is_scenario_builder_mode(agent_mode: Option<&str>) -> bool {
        matches!(agent_mode.map(str::trim), Some("scenario_builder"))
    }

    pub fn all_tool_names_for_mode(&self, agent_mode: Option<&str>) -> Vec<String> {
        if Self::is_scenario_builder_mode(agent_mode) {
            let mut names = SCENARIO_BUILDER_BASE_TOOLS
                .iter()
                .map(|name| (*name).to_owned())
                .collect::<HashSet<_>>();
            names.extend(self.scenario_builder_only_tools.iter().cloned());
            names.extend(self.mandatory_tools.iter().cloned());
            let mut list = names
                .into_iter()
                .filter(|name| self.by_name.contains_key(name))
                .collect::<Vec<_>>();
            list.sort();
            return list;
        }

        let mut names: Vec<String> = self
            .by_name
            .keys()
            .filter(|name| !self.scenario_builder_only_tools.contains(name.as_str()))
            .cloned()
            .collect();
        names.sort();
        names
    }

    pub fn filter_tool_names_for_mode(
        &self,
        tool_names: HashSet<String>,
        agent_mode: Option<&str>,
    ) -> HashSet<String> {
        if Self::is_scenario_builder_mode(agent_mode) {
            let allowed = self
                .all_tool_names_for_mode(agent_mode)
                .into_iter()
                .collect::<HashSet<_>>();
            return tool_names
                .into_iter()
                .filter(|name| allowed.contains(name))
                .collect();
        }

        tool_names
            .into_iter()
            .filter(|name| !self.scenario_builder_only_tools.contains(name))
            .collect()
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
        let mut enabled: HashSet<String> = enabled_names.iter().cloned().collect();
        enabled.extend(self.mandatory_tools.iter().cloned());

        let mut list: Vec<OllamaToolDefinition> = self
            .by_name
            .values()
            .filter(|definition| enabled.contains(&definition.function.name))
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

    pub fn mandatory_tool_names(&self) -> Vec<String> {
        let mut names = self.mandatory_tools.iter().cloned().collect::<Vec<_>>();
        names.sort();
        names
    }
}
