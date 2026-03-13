use std::collections::BTreeMap;

use reqwest::Client;
use serde_json::{json, Value};

use crate::domain::error::CoreError;
use crate::tools::builtin_tools::{
    object_schema, package_tool_with_output, string_schema, BuiltinToolPackage,
};

pub fn build_studying_pack() -> BuiltinToolPackage {
    let mut schedule_props = BTreeMap::new();
    schedule_props.insert(
        "date_value".to_owned(),
        string_schema("Дата в формате YYYY-MM-DD"),
    );

    BuiltinToolPackage {
        id: "studying-tools".to_owned(),
        title: "Учебные инструменты".to_owned(),
        description: "Инструменты для работы с учебными сервисами.".to_owned(),
        tools: vec![package_tool_with_output(
            "studying-tools",
            "Учебные инструменты",
            "Инструменты для работы с учебными сервисами.",
            "schedule_mirea_tool",
            "Загружает и группирует расписание МИРЭА по дням",
            object_schema(schedule_props, &["date_value"]),
            json!({
                "type": "object",
                "properties": {
                    "date": { "type": "string" },
                    "weekday": { "type": "string" },
                    "lessons": { "type": "array", "items": { "type": "object" } }
                }
            }),
        )],
    }
}

pub async fn fetch_mirea_schedule_by_date(date_value: &str) -> Result<Value, CoreError> {
    let url = format!("https://schedule-of.mirea.ru/?date={}&s=1_778", date_value);
    let html = Client::new()
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|error| CoreError::Tool(error.to_string()))?
        .text()
        .await
        .map_err(|error| CoreError::Tool(error.to_string()))?;

    let ical_content = extract_ical_from_html(&html)?;
    Ok(parse_schedule(&ical_content, Some(date_value)))
}

fn extract_ical_from_html(html_content: &str) -> Result<String, CoreError> {
    let open_tag = "<script id=\"__NEXT_DATA__\"";
    let Some(start_idx) = html_content.find(open_tag) else {
        return Err(CoreError::Tool("next_data_not_found".to_owned()));
    };
    let script_slice = &html_content[start_idx..];
    let Some(content_start_rel) = script_slice.find('>') else {
        return Err(CoreError::Tool("next_data_not_found".to_owned()));
    };
    let content_start = start_idx + content_start_rel + 1;
    let Some(end_rel) = html_content[content_start..].find("</script>") else {
        return Err(CoreError::Tool("next_data_not_found".to_owned()));
    };
    let json_text = &html_content[content_start..content_start + end_rel];
    let parsed = serde_json::from_str::<Value>(json_text)
        .map_err(|error| CoreError::Tool(error.to_string()))?;

    let ical_content = parsed
        .get("props")
        .and_then(|value| value.get("pageProps"))
        .and_then(|value| value.get("scheduleLoadInfo"))
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|value| value.get("iCalContent"))
        .and_then(Value::as_str)
        .ok_or_else(|| CoreError::Tool("ical_content_not_found".to_owned()))?;

    Ok(ical_content.to_owned())
}

fn parse_schedule(ical_content: &str, target_date: Option<&str>) -> Value {
    let normalized = ical_content.replace("\\r\\n", "\r\n").replace("\\n", "\n");
    let unfolded = unfold_lines(&normalized);
    let events = parse_events(&unfolded);
    let mut grouped = serde_json::Map::new();

    for event in events {
        let summary = read_property(&event, "SUMMARY");
        if summary.to_lowercase().contains("неделя") {
            continue;
        }

        let Some(start_raw) = read_property_optional(&event, "DTSTART") else {
            continue;
        };
        let Some((start_date_key, time_text)) = parse_event_start(&start_raw) else {
            continue;
        };

        let rrule_raw = read_property_optional(&event, "RRULE");
        let exdate_raw = read_property_optional(&event, "EXDATE");

        let date_key = if let Some(target) = target_date {
            if let Some(rule) = rrule_raw.as_deref() {
                if !matches_weekly_rrule_for_target(
                    &start_date_key,
                    target,
                    rule,
                    exdate_raw.as_deref(),
                ) {
                    continue;
                }

                target.to_owned()
            } else {
                if start_date_key != target {
                    continue;
                }

                start_date_key.clone()
            }
        } else {
            start_date_key.clone()
        };

        let description = read_property(&event, "DESCRIPTION");
        let location = read_property(&event, "LOCATION");
        let uid = read_property(&event, "UID");
        let categories = read_property(&event, "CATEGORIES");
        let weekday = weekday_ru(&date_key);
        let lessons_value = grouped
            .entry(date_key.clone())
            .or_insert_with(|| json!({ "weekday": weekday, "lessons": [] }));

        if let Some(lessons) = lessons_value
            .get_mut("lessons")
            .and_then(Value::as_array_mut)
        {
            lessons.push(json!({
                "time": time_text,
                "subject": summary,
                "type": categories,
                "teacher": extract_teacher(&description),
                "location": location,
                "uid": uid,
            }));
        }
    }

    Value::Object(grouped)
}

fn matches_weekly_rrule_for_target(
    start_date_key: &str,
    target_date_key: &str,
    rrule_raw: &str,
    exdate_raw: Option<&str>,
) -> bool {
    let (start_year, start_month, start_day) = match parse_date_key(start_date_key) {
        Some(value) => value,
        None => return false,
    };

    let (target_year, target_month, target_day) = match parse_date_key(target_date_key) {
        Some(value) => value,
        None => return false,
    };

    if weekday_from_date(start_year, start_month, start_day)
        != weekday_from_date(target_year, target_month, target_day)
    {
        return false;
    }

    let start_ordinal = date_to_ordinal(start_year, start_month, start_day);
    let target_ordinal = date_to_ordinal(target_year, target_month, target_day);

    if target_ordinal < start_ordinal {
        return false;
    }

    let mut freq_weekly = false;
    let mut interval_weeks: i32 = 1;
    let mut until_date: Option<(i32, i32, i32)> = None;

    for part in rrule_raw.split(';') {
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };

        match key.trim() {
            "FREQ" => {
                freq_weekly = value.trim().eq_ignore_ascii_case("WEEKLY");
            }
            "INTERVAL" => {
                interval_weeks = value.trim().parse::<i32>().ok().filter(|v| *v > 0).unwrap_or(1);
            }
            "UNTIL" => {
                until_date = parse_until_date(value.trim());
            }
            _ => {}
        }
    }

    if !freq_weekly {
        return false;
    }

    if let Some((until_y, until_m, until_d)) = until_date {
        let until_ordinal = date_to_ordinal(until_y, until_m, until_d);
        if target_ordinal > until_ordinal {
            return false;
        }
    }

    let day_delta = target_ordinal - start_ordinal;

    if day_delta % 7 != 0 {
        return false;
    }

    let weeks_since_start = day_delta / 7;

    if weeks_since_start % interval_weeks != 0 {
        return false;
    }

    if exdate_contains_date(exdate_raw, target_date_key) {
        return false;
    }

    true
}

fn exdate_contains_date(exdate_raw: Option<&str>, target_date_key: &str) -> bool {
    let Some(raw) = exdate_raw else {
        return false;
    };

    raw.split(',').any(|item| {
        let digits = item
            .chars()
            .filter(|ch| ch.is_ascii_digit())
            .collect::<String>();

        if digits.len() < 8 {
            return false;
        }

        let date_key = format!("{}-{}-{}", &digits[0..4], &digits[4..6], &digits[6..8]);
        date_key == target_date_key
    })
}

fn parse_until_date(raw: &str) -> Option<(i32, i32, i32)> {
    let digits = raw
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>();

    if digits.len() < 8 {
        return None;
    }

    let year = digits[0..4].parse::<i32>().ok()?;
    let month = digits[4..6].parse::<i32>().ok()?;
    let day = digits[6..8].parse::<i32>().ok()?;

    Some((year, month, day))
}

fn parse_date_key(value: &str) -> Option<(i32, i32, i32)> {
    let mut parts = value.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = parts.next()?.parse::<i32>().ok()?;
    let day = parts.next()?.parse::<i32>().ok()?;

    Some((year, month, day))
}

fn date_to_ordinal(year: i32, month: i32, day: i32) -> i32 {
    let a = (14 - month) / 12;
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;

    day + ((153 * m + 2) / 5) + 365 * y + (y / 4) - (y / 100) + (y / 400) - 32045
}

fn unfold_lines(input: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    for raw_line in input.lines() {
        let line = raw_line.trim_end_matches('\r');
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(last) = lines.last_mut() {
                last.push_str(line.trim_start());
            }
        } else {
            lines.push(line.to_owned());
        }
    }

    lines
}

fn parse_events(lines: &[String]) -> Vec<Vec<String>> {
    let mut events = Vec::new();
    let mut current = Vec::new();
    let mut in_event = false;

    for line in lines {
        if line == "BEGIN:VEVENT" {
            in_event = true;
            current.clear();
            continue;
        }

        if line == "END:VEVENT" {
            if in_event {
                events.push(current.clone());
            }
            in_event = false;
            current.clear();
            continue;
        }

        if in_event {
            current.push(line.clone());
        }
    }

    events
}

fn read_property(event: &[String], key: &str) -> String {
    read_property_optional(event, key).unwrap_or_default()
}

fn read_property_optional(event: &[String], key: &str) -> Option<String> {
    event.iter().find_map(|line| {
        let (name_and_params, value) = line.split_once(':')?;
        let name = name_and_params.split(';').next()?.trim();
        if name == key {
            Some(value.trim().to_owned())
        } else {
            None
        }
    })
}

fn parse_event_start(raw: &str) -> Option<(String, String)> {
    let digits = raw.chars().filter(|ch| ch.is_ascii_digit()).collect::<String>();
    if digits.len() < 8 {
        return None;
    }

    let date_key = format!("{}-{}-{}", &digits[0..4], &digits[4..6], &digits[6..8]);
    let time_text = if digits.len() >= 12 {
        format!("{}:{}", &digits[8..10], &digits[10..12])
    } else {
        "00:00".to_owned()
    };

    Some((date_key, time_text))
}

fn weekday_ru(date_key: &str) -> &'static str {
    let parts = date_key.split('-').collect::<Vec<_>>();
    if parts.len() != 3 {
        return "";
    }

    let year = parts[0].parse::<i32>().unwrap_or_default();
    let month = parts[1].parse::<i32>().unwrap_or_default();
    let day = parts[2].parse::<i32>().unwrap_or_default();
    match weekday_from_date(year, month, day) {
        0 => "воскресенье",
        1 => "понедельник",
        2 => "вторник",
        3 => "среда",
        4 => "четверг",
        5 => "пятница",
        6 => "суббота",
        _ => "",
    }
}

fn weekday_from_date(year: i32, month: i32, day: i32) -> i32 {
    let (year, month) = if month < 3 { (year - 1, month + 12) } else { (year, month) };
    let k = year % 100;
    let j = year / 100;
    let h = (day + (13 * (month + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7;
    (h + 6) % 7
}

fn extract_teacher(description: &str) -> String {
    description
        .split("\\n")
        .find_map(|line| line.strip_prefix("Преподаватель: "))
        .unwrap_or_default()
        .trim()
        .to_owned()
}
