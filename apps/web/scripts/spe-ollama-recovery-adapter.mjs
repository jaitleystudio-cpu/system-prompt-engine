#!/usr/bin/env node
/**
 * Optional example adapter to a USER-RUNNING local Ollama model.
 * This is not a model router and never grants permission to run itself.
 * No network call beyond http://127.0.0.1:11434/api/generate.
 *
 * Caller must explicitly configure this adapter with
 * SPE_MODEL_COMMAND_JSON and SPE_ALLOW_MODEL_EXECUTION=YES.
 */
const MODEL = process.env.SPE_OLLAMA_MODEL;
if (!MODEL || !/^[a-zA-Z0-9_.:/-]{1,120}$/.test(MODEL))
  throw new Error("SPE_OLLAMA_MODEL must be a pinned, explicitly chosen local model identifier");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk.toString();
  if (input.length > 120_000) throw new Error("PROMPT_TOO_LARGE");
}
const request = JSON.parse(input);
if (!["INITIAL", "REPAIR"].includes(request.phase) || typeof request.prompt !== "string")
  throw new Error("INVALID_EXECUTION_REQUEST");
const prompt = [
  request.prompt,
  "Return one complete standalone HTML document with embedded CSS and JS.",
  "Never include external assets or external library imports.",
  "Return ONLY a JSON object containing the html string; no Markdown.",
].join("\n\n");
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), 85_000);
let payload;
try {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, format: "json" }),
    signal: abort.signal,
  });
  if (!response.ok) throw new Error("LOCAL_MODEL_HTTP_" + response.status);
  payload = await response.json();
} finally {
  clearTimeout(timer);
}
let result;
try {
  result = JSON.parse(payload.response);
} catch {
  throw new Error("LOCAL_MODEL_DID_NOT_RETURN_JSON");
}
if (!result || typeof result.html !== "string") throw new Error("LOCAL_MODEL_DID_NOT_RETURN_HTML");
process.stdout.write(JSON.stringify({
  html: result.html, model: MODEL,
  requestId: "LOCAL_OLLAMA_RESPONSE_NOT_INDEPENDENTLY_ATTESTED",
}) + "\n");
