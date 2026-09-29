"""Massive-intake errors. Codes only; payloads stay in custody, not messages."""


class MassiveError(Exception):
    def __init__(self, code: str, reason: str) -> None:
        super().__init__(code + ": " + reason)
        self.code = code
        self.reason = reason
