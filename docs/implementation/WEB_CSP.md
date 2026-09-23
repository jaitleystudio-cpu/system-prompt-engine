# Web content security policy

The production HTML now includes a CSP meta policy. Static hosts that support `_headers` also receive the equivalent response policy plus `frame-ancestors 'none'`, nosniff and no-referrer. A host that ignores `_headers` must configure those response headers separately; deployment enforcement must be verified on the actual host.

Scripts are same-origin. `wasm-unsafe-eval` permits the real local WASM engine without enabling arbitrary JavaScript eval. Inline styles remain allowed because React and the Three.js scene set dynamic styles. Objects are disabled; connections are same-origin. Images may use local data/blob previews. No analytics are added.

Frame protection cannot be expressed through a meta policy. Browser speech recognition is an explicitly opted-in browser service and may use a vendor network service outside the page's fetch path; do not describe speech as guaranteed offline.

Navigation requests use the network first and fall back to the installed shell offline. Arbitrary navigation responses are not written to the cache. Asset requests respect Vary and use the current cache only. The build generates the shell asset list and version.
