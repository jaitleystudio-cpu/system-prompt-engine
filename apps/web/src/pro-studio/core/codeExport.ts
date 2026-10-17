// Export a prompt as starter code. Pure string generation: nothing is sent anywhere.
// The model name is whatever the user types; Pro Studio does not pick or recommend a model.
export type CodeTarget = "curl-openai" | "python-openai" | "js-openai" | "curl-anthropic" | "python-anthropic";
export const CODE_TARGETS: { id: CodeTarget; label: string; file: string }[] = [
  { id: "python-openai", label: "Python · OpenAI SDK", file: "prompt_openai.py" },
  { id: "js-openai", label: "JavaScript · OpenAI SDK", file: "prompt_openai.mjs" },
  { id: "curl-openai", label: "cURL · OpenAI Chat Completions", file: "prompt_openai.sh" },
  { id: "python-anthropic", label: "Python · Anthropic SDK", file: "prompt_anthropic.py" },
  { id: "curl-anthropic", label: "cURL · Anthropic Messages", file: "prompt_anthropic.sh" },
];
const js = (s: string) => JSON.stringify(s);
/** Single-quoted shell string: the only character that needs care is the single quote itself. */
export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const py = (s: string) => JSON.stringify(s); // JSON string literals are valid Python string literals for BMP text.

export function exportCode(target: CodeTarget, system: string, model: string, userMessage = "Hello"): string {
  const m = model.trim() || "YOUR_MODEL_NAME";
  switch (target) {
    case "python-openai":
      return `# pip install openai\n# Reads OPENAI_API_KEY from the environment.\nfrom openai import OpenAI\n\nclient = OpenAI()\nSYSTEM_PROMPT = ${py(system)}\n\nresponse = client.chat.completions.create(\n    model=${py(m)},\n    messages=[\n        {"role": "system", "content": SYSTEM_PROMPT},\n        {"role": "user", "content": ${py(userMessage)}},\n    ],\n)\nprint(response.choices[0].message.content)\n`;
    case "js-openai":
      return `// npm install openai\n// Reads OPENAI_API_KEY from the environment.\nimport OpenAI from "openai";\n\nconst client = new OpenAI();\nconst SYSTEM_PROMPT = ${js(system)};\n\nconst response = await client.chat.completions.create({\n  model: ${js(m)},\n  messages: [\n    { role: "system", content: SYSTEM_PROMPT },\n    { role: "user", content: ${js(userMessage)} },\n  ],\n});\nconsole.log(response.choices[0].message.content);\n`;
    case "curl-openai": {
      const body = JSON.stringify({ model: m, messages: [{ role: "system", content: system }, { role: "user", content: userMessage }] }, null, 2);
      return `curl https://api.openai.com/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $OPENAI_API_KEY" \\\n  -d ${shellQuote(body)}\n`;
    }
    case "python-anthropic":
      return `# pip install anthropic\n# Reads ANTHROPIC_API_KEY from the environment.\nimport anthropic\n\nclient = anthropic.Anthropic()\nSYSTEM_PROMPT = ${py(system)}\n\nmessage = client.messages.create(\n    model=${py(m)},\n    max_tokens=1024,\n    system=SYSTEM_PROMPT,\n    messages=[{"role": "user", "content": ${py(userMessage)}}],\n)\nprint(message.content[0].text)\n`;
    case "curl-anthropic": {
      const body = JSON.stringify({ model: m, max_tokens: 1024, system, messages: [{ role: "user", content: userMessage }] }, null, 2);
      return `curl https://api.anthropic.com/v1/messages \\\n  -H "content-type: application/json" \\\n  -H "x-api-key: $ANTHROPIC_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -d ${shellQuote(body)}\n`;
    }
  }
}
