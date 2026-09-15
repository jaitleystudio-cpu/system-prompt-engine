//! JSON-in / JSON-out evaluator for the Python subprocess harness.
//! network_mode=NONE. not_a_release.

fn main() {
    let mut raw = String::new();
    if let Err(e) = std::io::Read::read_to_string(&mut std::io::stdin(), &mut raw) {
        eprintln!("stdin: {e}");
        std::process::exit(2);
    }
    let out = spe_core_rs::evaluate_json_str(&raw);
    print!("{out}");
}
