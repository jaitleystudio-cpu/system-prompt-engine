use serde_json::{json, Value};
use spe_core_rs::k3;

fn print_unicode(label: &str, s: &str) {
    let bytes = s.as_bytes();
    let bytes_hex = bytes.iter().map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ");
    let codepoints = s.chars().map(|c| format!("U+{:04X}", c as u32)).collect::<Vec<_>>().join(" ");
    println!("--- {} ---", label);
    println!("  text: {:?}", s);
    println!("  bytes ({}): [{}]", bytes.len(), bytes_hex);
    println!("  scalars ({}): {}", s.chars().count(), codepoints);
}

#[test]
fn trace_boundaries_5_to_10() {
    let nfd = "e\u{0301}";
    println!("\n============================================================");
    println!("RUST BOUNDARY TRACE: NFD e\\u0301");
    println!("============================================================");

    let json_in = json!({
        "spe_api": "k3",
        "op": "select",
        "protected": {
            "goal": nfd,
            "hard_constraints": [],
            "budget": null,
            "desired_output": null,
            "facts": [],
            "authority_state": {"level": 0, "status": "NONE", "grants": []},
            "provenance": []
        },
        "category": {"display_label": "Writing"},
        "task": {}
    }).to_string();

    // Boundary 5: Rust deserialization
    let parsed: Value = serde_json::from_str(&json_in).expect("serde_json parse");
    let b5_goal = parsed["protected"]["goal"].as_str().unwrap();
    print_unicode("5. Rust deserialization (parsed[protected][goal])", b5_goal);
    assert_eq!(b5_goal, nfd, "Boundary 5 must match NFD");

    // Boundary 6: Rust domain/input structure
    // Inside k3::select, input is parsed as Map and protected_view is constructed
    let root = parsed.as_object().cloned().unwrap();
    let protected = root.get("protected").and_then(|v| v.as_object()).unwrap();
    let b6_goal = protected.get("goal").and_then(|v| v.as_str()).unwrap();
    print_unicode("6. Rust domain/input structure (protected[goal])", b6_goal);
    assert_eq!(b6_goal, nfd, "Boundary 6 must match NFD");

    // Boundary 7 & 8 & 9: Engine processing & Output/request echo
    // Run k3::evaluate (which calls select & effect::bind)
    let output = k3::evaluate(&parsed).expect("k3 evaluate");
    let b9_goal = output["prompt_effect_plan"]["protected_fields"]["goal"].as_str().unwrap();
    let b9_prompt = output["prompt_effect_plan"]["compiled_prompt"].as_str().unwrap();
    print_unicode("9. Rust output echo (protected_fields.goal BEFORE wrap_raw_output)", b9_goal);
    print_unicode("9. Rust output echo (compiled_prompt snippet BEFORE wrap_raw_output)", &b9_prompt[..40]);
    assert_eq!(b9_goal, nfd, "Boundary 9 BEFORE wrap_raw_output MUST still be NFD!");

    // Boundary 10: JSON serialization back to JS (wrap_raw_output / canonical_dumps)
    let wrapped = spe_core_rs::evaluate_json_str(&json_in);
    let wrapped_parsed: Value = serde_json::from_str(&wrapped).expect("wrapped parsed");
    let b10_goal = wrapped_parsed["output"]["prompt_effect_plan"]["protected_fields"]["goal"].as_str().unwrap();
    let b10_prompt = wrapped_parsed["output"]["prompt_effect_plan"]["compiled_prompt"].as_str().unwrap();
    print_unicode("10. Rust serialization back to JS (protected_fields.goal AFTER wrap_raw_output)", b10_goal);
    print_unicode("10. Rust serialization back to JS (compiled_prompt snippet AFTER wrap_raw_output)", &b10_prompt[..40]);

    if b10_goal == "\u{00e9}" {
        println!("\n>>> ROOT CAUSE DISCOVERED AT BOUNDARY 10: wrap_raw_output() calls canonical_dumps() which mutates NFD into NFC! <<<");
    }
}
