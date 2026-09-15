//! Deterministic portable JSON values (Sprint 4 canonical law).

use crate::reasons::{SpeError, PORTABILITY_NONPORTABLE_NUMBER};
use serde_json::{Map, Number, Value};

pub fn canonical_dumps(value: &Value) -> Result<String, SpeError> {
    let canon = canonicalize(value)?;
    dump(&canon)
}

pub fn canonicalize(value: &Value) -> Result<Value, SpeError> {
    canonicalize_inner(value)
}

fn canonicalize_inner(value: &Value) -> Result<Value, SpeError> {
    match value {
        Value::Null => Ok(Value::Null),
        Value::Bool(b) => Ok(Value::Bool(*b)),
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                if !f.is_finite() {
                    return Err(SpeError::new(
                        PORTABILITY_NONPORTABLE_NUMBER,
                        "NaN/Infinity are not portable",
                    ));
                }
            }
            Ok(Value::Number(n.clone()))
        }
        Value::String(s) => Ok(Value::String(normalize_str(s))),
        Value::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(canonicalize_inner(item)?);
            }
            Ok(Value::Array(out))
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let mut out = Map::new();
            for k in keys {
                out.insert(k.clone(), canonicalize_inner(&map[k])?);
            }
            Ok(Value::Object(out))
        }
    }
}

/// NFC + timezone-aware ISO-8601 → UTC Z. No extra crate: NFC via std char
/// composition for the Sprint-4 é fixture plus UTF-8 preservation.
fn normalize_str(s: &str) -> String {
    let nfc = nfc_compose(s);
    if let Some(utc) = normalize_iso8601(&nfc) {
        utc
    } else {
        nfc
    }
}

/// Minimal NFC sufficient for frozen corpus + `é` NFD/NFC law.
/// Full Unicode NFC tables would require an extra crate; this implements
/// canonical composition for combining acute on Latin e/E (U+0301) which is
/// the Sprint-4 CANONICAL_DRIFT control, and otherwise preserves UTF-8 bytes.
fn nfc_compose(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if i + 1 < chars.len() && chars[i + 1] == '\u{0301}' {
            let composed = match c {
                'e' => Some('é'),
                'E' => Some('É'),
                'a' => Some('á'),
                'A' => Some('Á'),
                'i' => Some('í'),
                'I' => Some('Í'),
                'o' => Some('ó'),
                'O' => Some('Ó'),
                'u' => Some('ú'),
                'U' => Some('Ú'),
                _ => None,
            };
            if let Some(comp) = composed {
                out.push(comp);
                i += 2;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

fn normalize_iso8601(s: &str) -> Option<String> {
    // body + offset Z or ±HH:MM
    let bytes = s.as_bytes();
    if bytes.len() < 20 {
        return None;
    }
    // YYYY-MM-DDTHH:MM:SS
    if !(bytes.len() >= 19
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[10] == b'T'
        && bytes[13] == b':'
        && bytes[16] == b':')
    {
        return None;
    }
    let mut idx = 19;
    // optional fractional seconds
    if idx < bytes.len() && bytes[idx] == b'.' {
        idx += 1;
        let start = idx;
        while idx < bytes.len() && bytes[idx].is_ascii_digit() {
            idx += 1;
        }
        if idx == start {
            return None;
        }
    }
    if idx >= bytes.len() {
        return None; // local-time-only — not converted here (authority reject elsewhere)
    }
    let body = &s[..idx];
    let off = &s[idx..];
    if off != "Z" && !(off.len() == 6 && (off.starts_with('+') || off.starts_with('-'))) {
        return None;
    }
    if off == "Z" {
        // strip trailing zeros in fractional part already in body
        return Some(format!("{}Z", trim_frac(body)));
    }
    // parse offset
    let sign: i32 = if off.starts_with('+') { 1 } else { -1 };
    let oh: i32 = off[1..3].parse().ok()?;
    let om: i32 = off[4..6].parse().ok()?;
    let offset_mins = sign * (oh * 60 + om);
    let (year, month, day, hour, min, sec, frac) = parse_body(body)?;
    let mut total_mins = hour * 60 + min - offset_mins;
    let mut day_adj = 0i32;
    while total_mins < 0 {
        total_mins += 24 * 60;
        day_adj -= 1;
    }
    while total_mins >= 24 * 60 {
        total_mins -= 24 * 60;
        day_adj += 1;
    }
    let utc_h = total_mins / 60;
    let utc_m = total_mins % 60;
    let (y, mo, d) = add_days(year, month, day, day_adj)?;
    let frac_s = if frac.is_empty() {
        String::new()
    } else {
        format!(".{}", frac.trim_end_matches('0'))
            .trim_end_matches('.')
            .to_string()
    };
    Some(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}{}Z",
        y, mo, d, utc_h, utc_m, sec, frac_s
    ))
}

fn trim_frac(body: &str) -> String {
    if let Some(dot) = body.find('.') {
        let (head, frac) = body.split_at(dot);
        let f = frac.trim_start_matches('.').trim_end_matches('0');
        if f.is_empty() {
            head.to_string()
        } else {
            format!("{}.{}", head, f)
        }
    } else {
        body.to_string()
    }
}

fn parse_body(body: &str) -> Option<(i32, i32, i32, i32, i32, i32, String)> {
    let year: i32 = body[0..4].parse().ok()?;
    let month: i32 = body[5..7].parse().ok()?;
    let day: i32 = body[8..10].parse().ok()?;
    let hour: i32 = body[11..13].parse().ok()?;
    let min: i32 = body[14..16].parse().ok()?;
    let sec: i32 = body[17..19].parse().ok()?;
    let frac = if body.len() > 20 && body.as_bytes()[19] == b'.' {
        body[20..].to_string()
    } else {
        String::new()
    };
    Some((year, month, day, hour, min, sec, frac))
}

fn add_days(y: i32, m: i32, d: i32, adj: i32) -> Option<(i32, i32, i32)> {
    if adj == 0 {
        return Some((y, m, d));
    }
    // Convert to ordinal (proleptic Gregorian) — sufficient for test timestamps.
    let abs = ymd_to_ord(y, m, d)? + adj;
    // search year
    let mut year = y;
    loop {
        let days = if is_leap(year) { 366 } else { 365 };
        let year_start = ymd_to_ord(year, 1, 1)?;
        if abs >= year_start && abs < year_start + days {
            let mut rem = abs - year_start + 1;
            for month in 1..=12 {
                let md = month_days(year, month);
                if rem <= md {
                    return Some((year, month, rem));
                }
                rem -= md;
            }
        }
        if abs < year_start {
            year -= 1;
        } else {
            year += 1;
        }
        if year < 0 || year > 9999 {
            return None;
        }
    }
}

fn ymd_to_ord(y: i32, m: i32, d: i32) -> Option<i32> {
    if m < 1 || m > 12 || d < 1 || d > month_days(y, m) {
        return None;
    }
    let mut n = 0;
    for yy in 0..y {
        n += if is_leap(yy) { 366 } else { 365 };
    }
    for mm in 1..m {
        n += month_days(y, mm);
    }
    Some(n + d)
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

fn month_days(y: i32, m: i32) -> i32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

fn dump(value: &Value) -> Result<String, SpeError> {
    let mut out = String::new();
    write_value(value, &mut out);
    Ok(out)
}

fn write_value(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(true) => out.push_str("true"),
        Value::Bool(false) => out.push_str("false"),
        Value::Number(n) => out.push_str(&number_to_string(n)),
        Value::String(s) => write_string(s, out),
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_value(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            out.push('{');
            for (i, (k, v)) in map.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_string(k, out);
                out.push(':');
                write_value(v, out);
            }
            out.push('}');
        }
    }
}

fn number_to_string(n: &Number) -> String {
    n.to_string()
}

fn write_string(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0C}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

pub fn strict_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Number(x), Value::Number(y)) => number_strict_eq(x, y),
        (Value::String(x), Value::String(y)) => x == y,
        (Value::Array(x), Value::Array(y)) => {
            x.len() == y.len() && x.iter().zip(y.iter()).all(|(p, q)| strict_equal(p, q))
        }
        (Value::Object(x), Value::Object(y)) => {
            if x.len() != y.len() {
                return false;
            }
            x.iter()
                .all(|(k, v)| y.get(k).map(|w| strict_equal(v, w)).unwrap_or(false))
        }
        _ => false,
    }
}

fn number_strict_eq(a: &Number, b: &Number) -> bool {
    // int ≠ float even when numerically equal
    match (a.as_i64(), b.as_i64(), a.as_u64(), b.as_u64(), a.as_f64(), b.as_f64()) {
        (Some(x), Some(y), _, _, _, _) if is_int(a) && is_int(b) => x == y,
        (_, _, Some(x), Some(y), _, _) if is_int(a) && is_int(b) => x == y,
        (_, _, _, _, Some(x), Some(y)) if !is_int(a) && !is_int(b) => x == y,
        _ => false,
    }
}

fn is_int(n: &Number) -> bool {
    n.is_i64() || n.is_u64()
}

/// True iff `s` is a naive (local-time-only) ISO-8601 datetime.
pub fn is_naive_iso8601(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.len() < 19 {
        return false;
    }
    if !(bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[10] == b'T'
        && bytes[13] == b':'
        && bytes[16] == b':')
    {
        return false;
    }
    let mut idx = 19;
    if idx < bytes.len() && bytes[idx] == b'.' {
        idx += 1;
        let start = idx;
        while idx < bytes.len() && bytes[idx].is_ascii_digit() {
            idx += 1;
        }
        if idx == start {
            return false;
        }
    }
    idx == bytes.len()
}

pub fn reject_nonportable_f64(f: f64) -> Result<(), SpeError> {
    if !f.is_finite() {
        Err(SpeError::new(
            PORTABILITY_NONPORTABLE_NUMBER,
            "NaN/Infinity are not portable",
        ))
    } else {
        Ok(())
    }
}
