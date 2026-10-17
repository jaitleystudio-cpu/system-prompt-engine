// Deterministic "model" scripts for demos and tests (SIMULATED). The code they return is real JavaScript that
// the harness really executes; only the model is scripted. Each script answers the first prompt with code that
// crashes and changes its answer only when the prompt carries the targeted repair for that exact error.
const fence = (code: string, claim: string) => "```js\n" + code + "\n```\n" + claim;
const TODOS_CLAUSE = /Do not reference `todos` unless you declare and initialise it first/;
const WINDOW_CLAUSE = /MUST NOT use `window` during server-side rendering/;

const SIMPLE_CRASH = 'const root = document.getElementById("root");\nroot.innerHTML = "<h1>My todos</h1><ul>" + todos.map((t) => "<li>" + t + "</li>").join("") + "</ul>";\nconsole.log("Done");';
const SIMPLE_FIXED = 'const todos = ["Buy milk", "Ship the release"];\nconst root = document.getElementById("root");\nroot.innerHTML = "<h1>My todos</h1><ul>" + todos.map((t) => "<li>" + t + "</li>").join("") + "</ul>";';

// A slightly larger app so that scope (what changed, and where) is measurable.
const APP = (opts: { list?: string; footer?: boolean; color?: string; filler?: number } = {}) => {
  const l = opts.list ?? "todos";
  const lines = [
    'const root = document.getElementById("root");',
    "function addTodo(list, text) { return list.concat([text]); }",
    ...(opts.footer === false ? [] : ['function footer(n) { return "<footer class=\\"todo-footer\\">" + n + " items left</footer>"; }']),
    `const title = "<h1 class=\\"title\\" style=\\"color: ${opts.color ?? "#222"}\\">My todos</h1>";`,
    'let items = addTodo([], "Buy milk");',
    'items = addTodo(items, "Ship the release");',
    ...Array.from({ length: opts.filler ?? 0 }, (_, i) => `const row${i} = "<!-- layout row ${i} -->";`),
    `root.innerHTML = title + "<ul>" + ${l}.map((t) => "<li>" + t + "</li>").join("") + "</ul>"${opts.footer === false ? "" : " + footer(items.length)"};`,
  ];
  return lines.join("\n");
};
const HERO_CRASH = 'const width = window.innerWidth;\nconst layout = "<section class=\\"hero\\" style=\\"min-height: 80vh\\"><canvas id=\\"scene\\"></canvas>";\nfunction render() { return layout + "<h1>3D Hero</h1><p>Viewport " + width + "px</p></section>"; }';
const HERO_FIXED = 'const width = typeof window !== "undefined" ? window.innerWidth : 1280;\nconst layout = "<section class=\\"hero\\" style=\\"min-height: 80vh\\"><canvas id=\\"scene\\"></canvas>";\nfunction render() { return layout + "<h1>3D Hero</h1><p>Viewport " + width + "px</p></section>"; }';

export function demoAnswer(system: string, user: string): string | null {
  const fixedTodos = TODOS_CLAUSE.test(system);
  if (user.includes("[demo:always-crash]")) return fence(SIMPLE_CRASH, "Done — fixed, all requirements met.");
  if (user.includes("[demo:crash-then-fix]")) return fixedTodos ? fence(SIMPLE_FIXED, "Done — the app renders.") : fence(SIMPLE_CRASH, "Done — all requirements met.");
  if (user.includes("[demo:ssr-window]")) return WINDOW_CLAUSE.test(system) ? fence(HERO_FIXED, "Done — hero renders on the server.") : fence(HERO_CRASH, "Done — 3D hero app built.");
  // Scope fixtures: same crash, different kinds of "fix".
  if (user.includes("[demo:scoped-fix]")) return fence(fixedTodos ? APP({ list: "items" }) : APP(), "Done.");
  if (user.includes("[demo:drift-rewrite]")) return fence(fixedTodos ? APP({ list: "items", filler: 200 }) : APP(), "Done — fixed, renders with 0 errors.");
  if (user.includes("[demo:drift-drop]")) return fence(fixedTodos ? APP({ list: "items", footer: false }) : APP(), "Done — fixed, renders with 0 errors.");
  if (user.includes("[demo:drift-style]")) return fence(fixedTodos ? APP({ list: "items", color: "#e11d48" }) : APP(), "Done — fixed, renders with 0 errors.");
  return null;
}
