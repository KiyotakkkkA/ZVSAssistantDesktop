use futures_util::StreamExt;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde_json::Value;
use crate::tools::builtin_tools::{builtin_tool_definitions_ref, builtin_tool_packages_ref};

pub(crate) fn normalize_base_url(base_url: Option<String>) -> String {
    let fallback = "http://127.0.0.1:11434".to_owned();
    let value = base_url
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback);
    value.trim_end_matches('/').to_owned()
}

pub(crate) fn auth_header_by_mode(token: &str, mode: &str) -> Option<String> {
    if token.trim().is_empty() {
        return None;
    }
    let normalized = token.trim();
    match mode {
        "none" => None,
        "raw" => Some(normalized.replacen("Bearer ", "", 1)),
        _ => {
            if normalized.to_ascii_lowercase().starts_with("bearer ") {
                Some(normalized.to_owned())
            } else {
                Some(format!("Bearer {}", normalized))
            }
        }
    }
}

pub(crate) fn is_unauthorized(status: Option<reqwest::StatusCode>, body: &str) -> bool {
    if let Some(status_code) = status
        && status_code.as_u16() == 401
    {
        return true;
    }
    let lowered = body.to_ascii_lowercase();
    lowered.contains("unauthorized") || lowered.contains("401")
}

pub(crate) async fn post_non_stream_with_auth_fallback(
    endpoint_url: &str,
    token: &str,
    body_value: &Value,
) -> napi::Result<Value> {
    let modes = if token.trim().is_empty() {
        vec!["none"]
    } else {
        vec!["bearer", "raw", "none"]
    };
    let mut last_error = String::new();
    for mode in modes {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(auth) = auth_header_by_mode(token, mode)
            && let Ok(value) = HeaderValue::from_str(&auth)
        {
            headers.insert(AUTHORIZATION, value);
        }
        let client = Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|error| Error::from_reason(error.to_string()))?;
        let response = match client.post(endpoint_url).json(body_value).send().await {
            Ok(response) => response,
            Err(error) => {
                last_error = error.to_string();
                continue;
            }
        };
        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|error| Error::from_reason(error.to_string()))?;
        if !status.is_success() {
            if is_unauthorized(Some(status), &text) {
                last_error = text.to_owned();
                continue;
            }
            return Err(Error::from_reason(if text.trim().is_empty() {
                format!("Request failed ({})", status)
            } else {
                text
            }));
        }
        let parsed: Value = serde_json::from_str(&text)
            .map_err(|error| Error::from_reason(format!("Invalid JSON: {}", error)))?;
        return Ok(parsed);
    }
    Err(Error::from_reason(if last_error.is_empty() {
        "Ollama auth failed".to_owned()
    } else {
        format!("Ollama auth failed: {}", last_error)
    }))
}

async fn stream_post_with_callback(
    endpoint_url: &str,
    token: &str,
    body_value: &Value,
    on_chunk: &ThreadsafeFunction<String, ErrorStrategy::CalleeHandled>,
) -> napi::Result<()> {
    let modes = if token.trim().is_empty() {
        vec!["none"]
    } else {
        vec!["bearer", "raw", "none"]
    };
    let mut last_error = String::new();

    for mode in modes {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(auth) = auth_header_by_mode(token, mode)
            && let Ok(value) = HeaderValue::from_str(&auth)
        {
            headers.insert(AUTHORIZATION, value);
        }
        let client = Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|error| Error::from_reason(error.to_string()))?;
        let response = match client.post(endpoint_url).json(body_value).send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };
        let status = response.status();
        if !status.is_success() {
            let text = response.text().await.unwrap_or_default();
            if is_unauthorized(Some(status), &text) {
                last_error = text;
                continue;
            }
            return Err(Error::from_reason(if text.trim().is_empty() {
                format!("Request failed ({})", status)
            } else {
                text
            }));
        }

        let mut buffer = String::new();
        let mut stream = response.bytes_stream();
        let mut got_done = false;

        while let Some(chunk_result) = stream.next().await {
            let bytes = chunk_result.map_err(|e| Error::from_reason(e.to_string()))?;
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer.drain(..=pos);
                if line.is_empty() {
                    continue;
                }
                let parsed: Value = serde_json::from_str(&line)
                    .map_err(|e| Error::from_reason(format!("Stream JSON error: {}", e)))?;
                if parsed.get("done").and_then(Value::as_bool).unwrap_or(false) {
                    got_done = true;
                }
                let chunk_json = serde_json::to_string(&parsed)
                    .map_err(|e| Error::from_reason(e.to_string()))?;
                on_chunk.call(Ok(chunk_json), ThreadsafeFunctionCallMode::NonBlocking);
            }
        }

        let rest = buffer.trim().to_string();
        if !rest.is_empty()
            && let Ok(parsed) = serde_json::from_str::<Value>(&rest)
        {
            if parsed.get("done").and_then(Value::as_bool).unwrap_or(false) {
                got_done = true;
            }
            let chunk_json = serde_json::to_string(&parsed)
                .map_err(|e| Error::from_reason(e.to_string()))?;
            on_chunk.call(Ok(chunk_json), ThreadsafeFunctionCallMode::NonBlocking);
        }

        if !got_done {
            let mut fallback_payload = body_value.clone();
            if let Value::Object(object) = &mut fallback_payload {
                object.insert("stream".to_owned(), Value::Bool(false));
            }
            let fallback =
                post_non_stream_with_auth_fallback(endpoint_url, token, &fallback_payload).await?;
            if !fallback.is_null() {
                let chunk_json = serde_json::to_string(&fallback)
                    .map_err(|e| Error::from_reason(e.to_string()))?;
                on_chunk.call(Ok(chunk_json), ThreadsafeFunctionCallMode::NonBlocking);
            }
        }

        return Ok(());
    }

    Err(Error::from_reason(if last_error.is_empty() {
        "Ollama auth failed".to_owned()
    } else {
        format!("Ollama auth failed: {}", last_error)
    }))
}

#[napi(js_name = "streamChat")]
pub async fn stream_chat_callback(
    payload_json: String,
    token: String,
    base_url: Option<String>,
    #[napi(ts_arg_type = "(err: null | Error, chunk: string) => void")]
    callback: ThreadsafeFunction<String, ErrorStrategy::CalleeHandled>,
) -> napi::Result<()> {
    let mut payload: Value = serde_json::from_str(&payload_json)
        .map_err(|error| Error::from_reason(format!("Invalid payload JSON: {}", error)))?;
    if let Value::Object(ref mut object) = payload {
        object.insert("stream".to_owned(), Value::Bool(true));
    }
    let endpoint_url = format!("{}/api/chat", normalize_base_url(base_url));
    stream_post_with_callback(&endpoint_url, token.trim(), &payload, &callback).await
}

#[napi(js_name = "getBuiltinToolDefinitions")]
pub fn get_builtin_tool_definitions() -> napi::Result<String> {
    let definitions = builtin_tool_definitions_ref();
    serde_json::to_string(&definitions)
        .map_err(|error| Error::from_reason(error.to_string()))
}

#[napi(js_name = "getBuiltinToolPackages")]
pub fn get_builtin_tool_packages() -> napi::Result<String> {
    let packages = builtin_tool_packages_ref();
    serde_json::to_string(&packages).map_err(|error| Error::from_reason(error.to_string()))
}
