use serde_json::json;

fn evaluate_goal(raw_goal: &str) -> (String, String) {
    let json_in = json!({
        "spe_api": "k3",
        "op": "select",
        "protected": {
            "goal": raw_goal,
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

    let out_str = spe_core_rs::evaluate_json_str(&json_in);
    let parsed: serde_json::Value = serde_json::from_str(&out_str).expect("parse output JSON");

    let returned_goal = parsed["output"]["prompt_effect_plan"]["protected_fields"]["goal"]
        .as_str()
        .expect("goal as string")
        .to_string();

    let compiled_prompt = parsed["output"]["prompt_effect_plan"]["compiled_prompt"]
        .as_str()
        .expect("compiled_prompt as string")
        .to_string();

    (returned_goal, compiled_prompt)
}

#[test]
fn raw_user_request_preserved_byte_for_byte_without_normalization() {
    let cases = [
        ("nfd_e_acute", "e\u{0301}"),
        ("nfd_a_ring", "A\u{030A}"),
        ("nfd_n_tilde", "n\u{0303}"),
        ("nfd_u_umlaut", "u\u{0308}"),
        ("nfd_hangul_ga", "\u{1100}\u{1161}"),
        ("nfd_multiple_marks", "q\u{0307}\u{0323}"),
        ("greek_iota_subscript", "\u{03C9}\u{0313}\u{0342}\u{0345}"),
    ];

    for (name, raw_input) in cases {
        let (returned_goal, compiled_prompt) = evaluate_goal(raw_input);
        assert_eq!(
            returned_goal, raw_input,
            "[{name}] returned goal must be byte-for-byte identical to raw user request"
        );
        assert!(
            compiled_prompt.contains(raw_input),
            "[{name}] compiled_prompt must contain raw user request in its original representation"
        );
        // Verify exact byte lengths match
        assert_eq!(
            returned_goal.as_bytes(),
            raw_input.as_bytes(),
            "[{name}] returned goal bytes must match raw input bytes exactly"
        );
    }
}

#[test]
fn global_scripts_raw_preservation() {
    let scripts = [
        ("hindi_devanagari", "नमस्ते दुनिया! क्या हाल है? प्रोग्रामिंग"),
        ("telugu", "తెలుగు అక్షరాలు మరియు మాటలు ప్రోగ్రామింగ్"),
        ("tamil", "தமிழ் எழுத்துக்கள் மற்றும் சொற்கள்"),
        ("kannada", "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಮತ್ತು ಸಂಸ್ಕೃತಿ"),
        ("arabic_rtl", "مرحبا بك في محرك موجه النظام أهلاً وسهلاً"),
        ("hebrew_niqqud", "שָׁלוֹם עוֹלָם וּבְרוּכִים הַבָּאִים"),
        ("japanese_nfd_dakuten", "か\u{3099}んし\u{3099} (が) こんにちは世界"),
        ("chinese_simplified", "系统提示工程与自动化测试"),
        ("chinese_traditional", "系統提示詞工程與自動化測試"),
        ("vietnamese_stacked_accents", "tiếng Việt có dấu: ế, ờ, ặ, ỹ, chào thế giới"),
        ("thai_complex_marks", "สวัสดีชาวโลกและวิศวกรรมข้อความแจ้งเตือน"),
    ];

    for (script_name, raw_input) in scripts {
        let (returned_goal, compiled_prompt) = evaluate_goal(raw_input);
        assert_eq!(
            returned_goal, raw_input,
            "[{script_name}] returned goal must match exactly"
        );
        assert!(
            compiled_prompt.contains(raw_input),
            "[{script_name}] compiled prompt must preserve script text"
        );
        assert_eq!(
            returned_goal.as_bytes(),
            raw_input.as_bytes(),
            "[{script_name}] byte-level match required"
        );
    }
}

#[test]
fn emoji_and_complex_sequences_preserved() {
    let emoji_cases = [
        ("zwj_family", "👨‍👩‍👧‍👦"),
        ("flags", "🇮🇳 🇺🇸 🇬🇧 🇯🇵"),
        ("skin_tones", "👋🏽 👨🏼‍💻 👩🏾‍🔬"),
        ("variation_selectors", "❤️ ⭐ ☀️ ⚠️"),
        ("zwj_rainbow_flag", "🏳️‍🌈"),
    ];

    for (name, raw_input) in emoji_cases {
        let (returned_goal, compiled_prompt) = evaluate_goal(raw_input);
        assert_eq!(
            returned_goal, raw_input,
            "[{name}] returned emoji sequence must match exactly"
        );
        assert!(
            compiled_prompt.contains(raw_input),
            "[{name}] compiled prompt must preserve emoji sequence"
        );
        assert_eq!(
            returned_goal.as_bytes(),
            raw_input.as_bytes(),
            "[{name}] emoji byte identity preserved"
        );
    }
}

#[test]
fn compatibility_characters_never_folded_to_ascii() {
    // NFKC / NFKD compatibility characters that MUST NOT be folded
    let comp_cases = [
        ("ligature_fi", "\u{fb01}"),             // 'ﬁ' -> must NOT become 'fi'
        ("ligature_fl", "\u{fb02}"),             // 'ﬂ' -> must NOT become 'fl'
        ("fullwidth_digits", "１２３"),           // fullwidth 123 -> must NOT become 123
        ("fullwidth_latin", "ＡＢＣ"),            // fullwidth ABC -> must NOT become ABC
        ("circled_digits", "①②③"),              // circled 123 -> must NOT become 123
        ("fractions", "½ ⅓ ¼"),                  // vulgar fractions -> must NOT become 1/2 1/3 1/4
        ("math_blackboard_bold", "ℂ ℝ ℕ ℤ"),    // blackboard bold -> must NOT become C R N Z
        ("roman_numerals", "Ⅰ Ⅱ Ⅲ Ⅳ"),           // roman numerals -> must NOT become I II III IV
    ];

    for (name, raw_input) in comp_cases {
        let (returned_goal, compiled_prompt) = evaluate_goal(raw_input);
        assert_eq!(
            returned_goal, raw_input,
            "[{name}] raw input must NOT undergo compatibility decomposition"
        );
        assert!(
            compiled_prompt.contains(raw_input),
            "[{name}] compiled prompt must preserve compatibility glyphs"
        );
        assert_eq!(
            returned_goal.as_bytes(),
            raw_input.as_bytes(),
            "[{name}] exact byte preservation required"
        );
    }
}
