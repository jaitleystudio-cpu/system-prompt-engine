/** Visible copy when Build is asked for with no idea. Not an engine interruption. */
export const EMPTY_IDEA_MESSAGE = "Enter what you want SPE to build.";

export function workspaceBuildDisabled(busy: boolean, userRequest: string): boolean {
  return busy || userRequest.trim().length === 0;
}
