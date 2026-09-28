/** One reviewed headline per local calendar day. No network, tracking or randomness. */
export const dailyHeadlines = [
  ["Your idea.", "A clear prompt."],
  ["Start with an idea.", "Make it clear."],
  ["Say what you need.", "Give AI a clear task."],
  ["Big idea?", "Start with a prompt."],
  ["Less guesswork.", "Clearer prompts."],
  ["Your words.", "A better starting point."],
  ["Bring your idea.", "Find the right words."],
  ["From a quick thought", "to a clear prompt."],
  ["Make your next idea", "easy to explain."],
  ["A clear prompt", "starts with you."],
  ["What do you want", "to make today?"],
  ["Turn your notes", "into a clear prompt."],
  ["Tell AI what matters.", "Keep your idea clear."],
  ["One idea.", "A clear next step."],
  ["Start small.", "Make your idea clear."],
  ["Have an idea?", "Let’s make it clear."],
  ["Your next project", "starts with an idea."],
  ["More than a thought.", "A prompt you can use."],
  ["Bring the details.", "Build a clear prompt."],
  ["Make room", "for your next idea."],
  ["From your words", "to a clear task."],
  ["Give your idea", "a clear starting point."],
  ["You bring the idea.", "SPE helps you explain it."],
  ["A few words.", "A place to start."],
  ["Think it through.", "Make your prompt."],
  ["What’s on your mind?", "Start here."],
  ["Your ideas matter.", "Keep the details."],
  ["Take your idea", "one step further."],
  ["Make your thoughts", "easy to follow."],
  ["One clear prompt.", "Ready for your next idea."],
  ["Start with your words.", "Build from there."],
] as const;

export function dailyHeroIndex(date = new Date()) {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return (
    ((day % dailyHeadlines.length) + dailyHeadlines.length) %
    dailyHeadlines.length
  );
}
export function nextLocalMidnight(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
}
