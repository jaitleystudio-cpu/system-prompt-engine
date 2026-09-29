export class MassiveError extends Error {
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.name = "MassiveError";
    this.code = code;
    this.reason = reason;
  }
}
