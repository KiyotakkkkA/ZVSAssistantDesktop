use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::domain::chat::{OllamaToolDefinition, OllamaToolFunction, ToolParameterSchema};
use crate::tools::packs::{
    base_pack::build_base_pack, browser_pack::build_browser_pack,
    communication_pack::build_communication_pack, filesystem_pack::build_filesystem_pack,
    data_pack::build_data_pack, scenario_builder_pack::build_scenario_builder_pack,
    studying_pack::build_studying_pack, terminal_pack::build_terminal_pack,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfirmationSpec {
    pub title: String,
    pub prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinToolDescriptor {
    pub package_id: String,
    pub package_title: String,
    pub package_description: String,
    pub schema: OllamaToolDefinition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_scheme: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmation: Option<ToolConfirmationSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuiltinToolPackage {
    pub id: String,
    pub title: String,
    pub description: String,
    pub tools: Vec<BuiltinToolDescriptor>,
}

static BUILTIN_TOOL_PACKAGES: OnceLock<Vec<BuiltinToolPackage>> = OnceLock::new();
static INTERNAL_TOOL_DEFINITIONS: OnceLock<Vec<OllamaToolDefinition>> = OnceLock::new();
static BUILTIN_TOOL_DEFINITIONS: OnceLock<Vec<OllamaToolDefinition>> = OnceLock::new();

pub fn string_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "string".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

pub fn number_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "number".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

pub fn boolean_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "boolean".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: None,
        required: None,
    }
}

pub fn enum_string_schema(description: &str, values: &[&str]) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "string".to_owned(),
        description: Some(description.to_owned()),
        enum_values: Some(values.iter().map(|value| (*value).to_owned()).collect()),
        properties: None,
        items: None,
        required: None,
    }
}

pub fn array_of_strings_schema(description: &str) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "array".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: Some(Box::new(ToolParameterSchema {
            schema_type: "string".to_owned(),
            description: None,
            enum_values: None,
            properties: None,
            items: None,
            required: None,
        })),
        required: None,
    }
}

pub fn array_of_objects_schema(
    description: &str,
    properties: BTreeMap<String, ToolParameterSchema>,
    required: &[&str],
) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "array".to_owned(),
        description: Some(description.to_owned()),
        enum_values: None,
        properties: None,
        items: Some(Box::new(ToolParameterSchema {
            schema_type: "object".to_owned(),
            description: None,
            enum_values: None,
            properties: Some(properties),
            items: None,
            required: Some(required.iter().map(|item| (*item).to_owned()).collect()),
        })),
        required: None,
    }
}

pub fn object_schema(
    properties: BTreeMap<String, ToolParameterSchema>,
    required: &[&str],
) -> ToolParameterSchema {
    ToolParameterSchema {
        schema_type: "object".to_owned(),
        description: None,
        enum_values: None,
        properties: Some(properties),
        items: None,
        required: Some(required.iter().map(|item| (*item).to_owned()).collect()),
    }
}

fn tool(name: &str, description: &str, parameters: ToolParameterSchema) -> OllamaToolDefinition {
    OllamaToolDefinition {
        kind: "function".to_owned(),
        function: OllamaToolFunction {
            name: name.to_owned(),
            description: Some(description.to_owned()),
            parameters,
        },
    }
}

pub fn package_tool(
    package_id: &str,
    package_title: &str,
    package_description: &str,
    name: &str,
    description: &str,
    parameters: ToolParameterSchema,
) -> BuiltinToolDescriptor {
    BuiltinToolDescriptor {
        package_id: package_id.to_owned(),
        package_title: package_title.to_owned(),
        package_description: package_description.to_owned(),
        schema: tool(name, description, parameters),
        output_scheme: None,
        confirmation: None,
    }
}

pub fn package_tool_with_output(
    package_id: &str,
    package_title: &str,
    package_description: &str,
    name: &str,
    description: &str,
    parameters: ToolParameterSchema,
    output_scheme: Value,
) -> BuiltinToolDescriptor {
    BuiltinToolDescriptor {
        package_id: package_id.to_owned(),
        package_title: package_title.to_owned(),
        package_description: package_description.to_owned(),
        schema: tool(name, description, parameters),
        output_scheme: Some(output_scheme),
        confirmation: None,
    }
}

pub fn confirmation_spec(title: &str, prompt: &str) -> ToolConfirmationSpec {
    ToolConfirmationSpec {
        title: title.to_owned(),
        prompt: prompt.to_owned(),
    }
}

pub fn with_confirmation(
    mut descriptor: BuiltinToolDescriptor,
    confirmation: ToolConfirmationSpec,
) -> BuiltinToolDescriptor {
    descriptor.confirmation = Some(confirmation);
    descriptor
}

pub fn builtin_tool_packages() -> Vec<BuiltinToolPackage> {
    builtin_tool_packages_ref().to_vec()
}

pub fn builtin_tool_packages_ref() -> &'static [BuiltinToolPackage] {
    BUILTIN_TOOL_PACKAGES
        .get_or_init(|| {
            vec![
                build_base_pack(),
                build_browser_pack(),
                build_communication_pack(),
                build_data_pack(),
                build_filesystem_pack(),
                build_terminal_pack(),
                build_scenario_builder_pack(),
                build_studying_pack(),
            ]
        })
        .as_slice()
}

pub fn builtin_tool_definitions() -> Vec<OllamaToolDefinition> {
    builtin_tool_definitions_ref().to_vec()
}

pub fn builtin_tool_definitions_ref() -> &'static [OllamaToolDefinition] {
    BUILTIN_TOOL_DEFINITIONS
        .get_or_init(|| {
            let mut definitions = builtin_tool_packages_ref()
                .iter()
                .flat_map(|package| package.tools.iter().map(|tool| tool.schema.clone()))
                .collect::<Vec<_>>();

            definitions.extend(internal_tool_definitions_ref().iter().cloned());
            definitions
        })
        .as_slice()
}

pub fn internal_tool_definitions() -> Vec<OllamaToolDefinition> {
    internal_tool_definitions_ref().to_vec()
}

pub fn internal_tool_definitions_ref() -> &'static [OllamaToolDefinition] {
    INTERNAL_TOOL_DEFINITIONS
        .get_or_init(|| {
            let mut properties = BTreeMap::new();
            properties.insert(
                "doc_id".to_owned(),
                string_schema("Document id вида doc_{uuid} из результата инструмента"),
            );

            vec![tool(
                "get_tools_calling",
                "Возвращает полный payload результата вызова инструмента по doc_id. Используй когда нужен полный контекст вместо сжатого результата.",
                object_schema(properties, &["doc_id"]),
            )]
        })
        .as_slice()
}
