use futures_util::StreamExt;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use serde_json::Value;
use crate::tools::builtin_tools::builtin_tool_definitions;

fn normalize_base_url(base_url: Option<String>) -> String {
    let fallback = "http://127.0.0.1:11434".to_owned();
    let value = base_url
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback);
    value.trim_end_matches('/').to_owned()
}

fn auth_header_by_mode(token: &str, mode: &str) -> Option<String> {
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

fn is_unauthorized(status: Option<reqwest::StatusCode>, body: &str) -> bool {
    if let Some(status_code) = status {
        if status_code.as_u16() == 401 {
            return true;
        }
    }
    let lowered = body.to_ascii_lowercase();
    lowered.contains("unauthorized") || lowered.contains("401")
}

async fn post_with_auth_fallback(
    endpoint_url: &str,
    token: &str,
    body_value: &Value,
) -> napi::Result<Vec<Value>> {
    let modes = if token.trim().is_empty() {
        vec!["none"]
    } else {
        vec!["bearer", "raw", "none"]
    };
    let mut last_error = String::new();
    for mode in modes {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(auth) = auth_header_by_mode(token, mode) {
            if let Ok(value) = HeaderValue::from_str(&auth) {
                headers.insert(AUTHORIZATION, value);
            }
        }
        let client = Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|error| Error::from_reason(error.to_string()))?;
        let request = client.post(endpoint_url).json(body_value);
        let response_result = request.send().await;
        let response = match response_result {
            Ok(response) => response,
            Err(error) => {
                last_error = error.to_string();
                continue;
            }
        };
        let status = response.status();
        if !status.is_success() {
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| String::new());
            if is_unauthorized(Some(status), &text) {
                last_error = text.to_owned();
                continue;
            }
            return Err(Error::from_reason(if text.trim().is_empty() {
                format!("Request failed ({})", status)
            } else {
                text.to_owned()
            }));
        }
        let mut chunks: Vec<Value> = Vec::new();
        let mut buffer = String::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let bytes = chunk.map_err(|e| Error::from_reason(e.to_string()))?;
            buffer.push_str(&String::from_utf8_lossy(&bytes));
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer.drain(..=pos);
                if line.is_empty() {
                    continue;
                }
                let parsed: Value = serde_json::from_str(&line)
                    .map_err(|e| Error::from_reason(format!("Stream JSON error: {}", e)))?;
                chunks.push(parsed);
            }
        }
        let rest = buffer.trim().to_string();
        if !rest.is_empty() {
            if let Ok(parsed) = serde_json::from_str::<Value>(&rest) {
                chunks.push(parsed);
            }
        }
        let has_done_chunk = chunks.iter().any(|chunk| {
            chunk
                .get("done")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        });
        if !has_done_chunk {
            let mut fallback_payload = body_value.clone();
            if let Value::Object(object) = &mut fallback_payload {
                object.insert("stream".to_owned(), Value::Bool(false));
            }
            let fallback_first =
                post_non_stream_with_auth_fallback(endpoint_url, token, &fallback_payload).await?;
            if !fallback_first.is_null() {
                return Ok(vec![fallback_first]);
            }
        }
        return Ok(chunks);
    }
    Err(Error::from_reason(if last_error.is_empty() {
        "Ollama auth failed".to_owned()
    } else {
        format!("Ollama auth failed: {}", last_error)
    }))
}

async fn post_non_stream_with_auth_fallback(
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
        if let Some(auth) = auth_header_by_mode(token, mode) {
            if let Ok(value) = HeaderValue::from_str(&auth) {
                headers.insert(AUTHORIZATION, value);
            }
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

#[napi(js_name = "streamChat")]
pub async fn stream_chat(
    payload_json: String,
    token: String,
    base_url: Option<String>,
) -> napi::Result<String> {
    let mut payload: Value = serde_json::from_str(&payload_json)
        .map_err(|error| Error::from_reason(format!("Invalid payload JSON: {}", error)))?;
    if let Value::Object(ref mut object) = payload {
        object.insert("stream".to_owned(), Value::Bool(true));
    }
    let endpoint_url = format!("{}/api/chat", normalize_base_url(base_url));
    let chunks = post_with_auth_fallback(&endpoint_url, token.trim(), &payload).await?;
    serde_json::to_string(&chunks).map_err(|error| Error::from_reason(error.to_string()))
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
        if let Some(auth) = auth_header_by_mode(token, mode) {
            if let Ok(value) = HeaderValue::from_str(&auth) {
                headers.insert(AUTHORIZATION, value);
            }
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
        if !rest.is_empty() {
            if let Ok(parsed) = serde_json::from_str::<Value>(&rest) {
                if parsed.get("done").and_then(Value::as_bool).unwrap_or(false) {
                    got_done = true;
                }
                let chunk_json = serde_json::to_string(&parsed)
                    .map_err(|e| Error::from_reason(e.to_string()))?;
                on_chunk.call(Ok(chunk_json), ThreadsafeFunctionCallMode::NonBlocking);
            }
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

#[napi(js_name = "streamChatCallback")]
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

#[napi(js_name = "getEmbed")]
pub async fn get_embed(
    payload_json: String,
    token: String,
    base_url: Option<String>,
) -> napi::Result<String> {
    let payload: Value = serde_json::from_str(&payload_json)
        .map_err(|error| Error::from_reason(format!("Invalid payload JSON: {}", error)))?;
    let endpoint_url = format!("{}/api/embed", normalize_base_url(base_url));
    let first = post_non_stream_with_auth_fallback(&endpoint_url, token.trim(), &payload).await?;
    serde_json::to_string(&first).map_err(|error| Error::from_reason(error.to_string()))
}

#[napi(js_name = "getBuiltinToolDefinitions")]
pub fn get_builtin_tool_definitions() -> napi::Result<String> {
    let definitions = builtin_tool_definitions();
    serde_json::to_string(&definitions)
        .map_err(|error| Error::from_reason(error.to_string()))
}