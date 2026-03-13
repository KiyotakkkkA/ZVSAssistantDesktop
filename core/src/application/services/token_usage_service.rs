use serde::Serialize;
use serde_json::Value;
use tiktoken_rs::{CoreBPE, cl100k_base};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextWindowBreakdown {
    pub system: u32,
    pub system_instructions: u32,
    pub tool_definitions: u32,
    pub reserved_output: u32,
    pub user_context: u32,
    pub messages: u32,
    pub tool_results: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogTokenUsageSummary {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub total_spent_tokens: u32,
    pub context_window: ContextWindowBreakdown,
}

#[derive(Default)]
struct Accumulator {
    system: usize,
    system_instructions: usize,
    tool_definitions: usize,
    reserved_output: usize,
    user_context: usize,
    messages: usize,
    tool_results: usize,
    completion_tokens: usize,
}

fn count_text_tokens(encoder: Option<&CoreBPE>, text: &str) -> usize {
    if text.trim().is_empty() {
        return 0;
    }

    match encoder {
        Some(value) => value.encode_ordinary(text).len(),
        None => text.split_whitespace().count(),
    }
}

fn count_json_tokens(encoder: Option<&CoreBPE>, value: &Value) -> usize {
    match value {
        Value::Null => 0,
        Value::String(text) => count_text_tokens(encoder, text),
        Value::Number(number) => count_text_tokens(encoder, &number.to_string()),
        Value::Bool(value) => count_text_tokens(encoder, if *value { "true" } else { "false" }),
        _ => serde_json::to_string(value)
            .ok()
            .map(|raw| count_text_tokens(encoder, &raw))
            .unwrap_or(0),
    }
}

fn find_array_field<'a>(object: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a Vec<Value>> {
    for key in keys {
        if let Some(items) = object.get(*key).and_then(Value::as_array) {
            return Some(items);
        }
    }

    None
}

fn find_value_field<'a>(object: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    for key in keys {
        if let Some(value) = object.get(*key) {
            return Some(value);
        }
    }

    None
}

fn count_get_tools_calling_meta_tokens(
    encoder: Option<&CoreBPE>,
    tool_trace_object: &serde_json::Map<String, Value>,
) -> usize {
    let mut total = 0usize;

    if let Some(doc_id) = tool_trace_object.get("docId") {
        total += count_json_tokens(encoder, doc_id);
    }

    if let Some(status) = tool_trace_object.get("status") {
        total += count_json_tokens(encoder, status);
    }

    if let Some(message) = tool_trace_object.get("message") {
        total += count_json_tokens(encoder, message);
    }

    if let Some(tool_name) = tool_trace_object.get("toolName") {
        total += count_json_tokens(encoder, tool_name);
    }

    if let Some(args) = tool_trace_object.get("args") {
        if let Some(args_object) = args.as_object() {
            if let Some(doc_id) = args_object.get("docId") {
                total += count_json_tokens(encoder, doc_id);
            }
        } else {
            total += count_json_tokens(encoder, args);
        }
    }

    total
}

pub fn calculate_dialog_token_usage(payload: &Value) -> DialogTokenUsageSummary {
    let encoder = cl100k_base().ok();
    let encoder_ref = encoder.as_ref();

    let mut acc = Accumulator::default();

    if let Some(object) = payload.as_object() {
        if let Some(system_value) = find_value_field(object, &["system", "systemPrompt"]) {
            acc.system += count_json_tokens(encoder_ref, system_value);
        }

        if let Some(system_instructions) =
            find_value_field(object, &["systemInstructions", "instructions"]) {
            acc.system_instructions += count_json_tokens(encoder_ref, system_instructions);
        }

        if let Some(runtime_context) =
            find_value_field(object, &["runtimeContext", "userContext", "context"]) {
            acc.user_context += count_json_tokens(encoder_ref, runtime_context);
        }

        if let Some(tool_definitions) = find_value_field(object, &["toolDefinitions", "tools"]) {
            acc.tool_definitions += count_json_tokens(encoder_ref, tool_definitions);
        }

        if let Some(reserved_output) = find_value_field(object, &["reservedOutput", "maxOutputTokens"]) {
            acc.reserved_output += match reserved_output {
                Value::Number(number) => number
                    .as_u64()
                    .map(|value| value as usize)
                    .unwrap_or_else(|| count_json_tokens(encoder_ref, reserved_output)),
                _ => count_json_tokens(encoder_ref, reserved_output),
            };
        }

        if let Some(messages) = find_array_field(object, &["messages", "history"]) {
            for message in messages {
                let Some(message_object) = message.as_object() else {
                    acc.messages += count_json_tokens(encoder_ref, message);
                    continue;
                };

                let role = find_value_field(message_object, &["author", "role"])
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if let Some(content) = find_value_field(message_object, &["content", "text"]) {
                    let content_tokens = count_json_tokens(encoder_ref, content);
                    match role {
                        "system" => {
                            acc.system_instructions += content_tokens;
                            acc.messages += content_tokens;
                        }
                        "assistant" => {
                            acc.messages += content_tokens;
                            acc.completion_tokens += content_tokens;
                        }
                        "user" => {
                            acc.messages += content_tokens;
                            acc.user_context += content_tokens;
                        }
                        _ => {
                            acc.messages += content_tokens;
                        }
                    }
                }

                if let Some(thinking) = message_object.get("thinking") {
                    acc.messages += count_json_tokens(encoder_ref, thinking);
                }

                if let Some(tool_trace) = message_object.get("toolTrace") {
                    if let Some(tool_trace_object) = tool_trace.as_object() {
                        let tool_name = tool_trace_object
                            .get("toolName")
                            .and_then(Value::as_str)
                            .unwrap_or_default();

                        if tool_name == "get_tools_calling" {
                            acc.tool_results +=
                                count_get_tools_calling_meta_tokens(
                                    encoder_ref,
                                    tool_trace_object,
                                );
                        } else {
                            if let Some(args) = tool_trace_object.get("args") {
                                acc.tool_results += count_json_tokens(encoder_ref, args);
                            }
                            if let Some(result) = tool_trace_object.get("result") {
                                acc.tool_results += count_json_tokens(encoder_ref, result);
                            }
                        }
                    } else {
                        acc.tool_results += count_json_tokens(encoder_ref, tool_trace);
                    }
                }
            }
        }
    }

    let prompt_tokens = acc.system
        + acc.system_instructions
        + acc.tool_definitions
        + acc.reserved_output
        + acc.user_context
        + acc.tool_results;

    let total_tokens = prompt_tokens + acc.completion_tokens;

    DialogTokenUsageSummary {
        prompt_tokens: prompt_tokens.min(u32::MAX as usize) as u32,
        completion_tokens: acc.completion_tokens.min(u32::MAX as usize) as u32,
        total_tokens: total_tokens.min(u32::MAX as usize) as u32,
        total_spent_tokens: total_tokens.min(u32::MAX as usize) as u32,
        context_window: ContextWindowBreakdown {
            system: acc.system.min(u32::MAX as usize) as u32,
            system_instructions: acc.system_instructions.min(u32::MAX as usize) as u32,
            tool_definitions: acc.tool_definitions.min(u32::MAX as usize) as u32,
            reserved_output: acc.reserved_output.min(u32::MAX as usize) as u32,
            user_context: acc.user_context.min(u32::MAX as usize) as u32,
            messages: acc.messages.min(u32::MAX as usize) as u32,
            tool_results: acc.tool_results.min(u32::MAX as usize) as u32,
        },
    }
}
