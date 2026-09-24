//! Thin WASM / JSON-in JSON-out wrapper over `spe-core-rs`.
//!
//! This crate must not contain semantic detectors, reason tables, or
//! protected-field logic. All evaluation delegates to the portable kernel.
//!
//! Context-protocol web compile (Task 12) is exposed only through the same
//! `evaluate_json` → `spe_core_rs::evaluate_json_str` path:
//!   spe_api = "context_protocol", op = "compile"
//! Request fields (Rust-owned): source_mode AUTO|ON|OFF,
//! requested_depth AUTO|FAST|SMART|DEEP, capability_profile (optional).
//! Response fields (Rust-owned): context_summary, execution_contract,
//! quality_record, capability_profile_mode, resolved_depth.
//! The web TypeScript layer only transports/renders these results and must
//! fail closed when WASM is unavailable (no local protocol synthesis).

/// Evaluate a UTF-8 JSON fixture by delegating to `spe-core-rs`.
pub fn evaluate_json(input: &str) -> String {
    spe_core_rs::evaluate_json_str(input)
}

/// Host/WASM-callable JSON evaluation used by the Python harness.
pub fn evaluate_json_bytes(input: &[u8]) -> String {
    match std::str::from_utf8(input) {
        Ok(s) => evaluate_json(s),
        Err(_) => spe_core_rs::evaluate_json_str(""),
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm_abi {
    use super::evaluate_json;
    use std::alloc::{alloc, dealloc, Layout};

    #[no_mangle]
    pub extern "C" fn spe_alloc(n: usize) -> *mut u8 {
        if n == 0 {
            return std::ptr::null_mut();
        }
        unsafe { alloc(Layout::from_size_align_unchecked(n, 8)) }
    }

    #[no_mangle]
    pub extern "C" fn spe_free(ptr: *mut u8, n: usize) {
        if ptr.is_null() || n == 0 {
            return;
        }
        unsafe {
            dealloc(ptr, Layout::from_size_align_unchecked(n, 8));
        }
    }

    /// Returns a buffer: 4-byte little-endian length + UTF-8 JSON.
    #[no_mangle]
    pub extern "C" fn spe_evaluate(ptr: *const u8, len: usize) -> *mut u8 {
        let slice = unsafe { std::slice::from_raw_parts(ptr, len) };
        let out = match std::str::from_utf8(slice) {
            Ok(s) => evaluate_json(s),
            Err(_) => {
                "{\"disposition\":\"INVALID\",\"reason_code\":\"PORTABILITY_INVALID_FIXTURE\",\"output\":null,\"status\":\"INVALID\"}".to_string()
            }
        };
        pack(&out)
    }

    fn pack(s: &str) -> *mut u8 {
        let bytes = s.as_bytes();
        let total = 4 + bytes.len();
        let p = spe_alloc(total);
        unsafe {
            let len = (bytes.len() as u32).to_le_bytes();
            std::ptr::copy_nonoverlapping(len.as_ptr(), p, 4);
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), p.add(4), bytes.len());
        }
        p
    }
}
