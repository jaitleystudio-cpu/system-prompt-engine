"""SHA-256 custody hashes. Chain is spe.massive.chain.v1."""

from __future__ import annotations

import hashlib


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def chain_update(prev_hex: str | None, chunk_sha_hex: str) -> str:
    prev = b"" if prev_hex is None else bytes.fromhex(prev_hex)
    digest = hashlib.sha256(prev + bytes.fromhex(chunk_sha_hex)).hexdigest()
    return digest


def new_hasher() -> hashlib._Hash:
    return hashlib.sha256()
