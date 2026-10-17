/**
 * SPE Ω Pure RFC 8032 Ed25519 Public-Key Signature Verifier (Browser & Node Compatible)
 *
 * Security Invariant:
 * This client-accessible module implements ONLY public-key Ed25519 verification
 * (`verifyEd25519Signature`) and SHA-512 over UTF-8 / byte payloads.
 * No private keys, signing seeds, or shared secrets exist in this module.
 */

const Q = (1n << 255n) - 19n;
const L = (1n << 252n) + 27742317777372353535851937790883648493n;

function mod(a: bigint, m: bigint = Q): bigint {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modPow(base: bigint, exp: bigint, m: bigint = Q): bigint {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) {
      result = mod(result * b, m);
    }
    b = mod(b * b, m);
    e >>= 1n;
  }
  return result;
}

function modInv(a: bigint, m: bigint = Q): bigint {
  return modPow(a, m - 2n, m);
}

const D = mod(-121665n * modInv(121666n));
const I = modPow(2n, (Q - 1n) / 4n);

function xRecover(y: bigint): bigint {
  const y2 = mod(y * y);
  const xx = mod((y2 - 1n) * modInv(mod(D * y2 + 1n)));
  let x = modPow(xx, (Q + 3n) / 8n);
  if (mod(x * x - xx) !== 0n) {
    x = mod(x * I);
  }
  if (x & 1n) {
    x = Q - x;
  }
  return x;
}

const BY = mod(4n * modInv(5n));
const BX = xRecover(BY);
const BASE_POINT: [bigint, bigint] = [BX, BY];

function edwardsAdd(P: [bigint, bigint], R: [bigint, bigint]): [bigint, bigint] {
  const [x1, y1] = P;
  const [x2, y2] = R;
  const dxy = mod(D * mod(x1 * x2) * mod(y1 * y2));
  const x3 = mod(mod(x1 * y2 + x2 * y1) * modInv(mod(1n + dxy)));
  const y3 = mod(mod(y1 * y2 + x1 * x2) * modInv(mod(1n - dxy)));
  return [x3, y3];
}

function scalarMult(P: [bigint, bigint], e: bigint): [bigint, bigint] {
  let result: [bigint, bigint] = [0n, 1n];
  let addend = P;
  let k = e;
  while (k > 0n) {
    if (k & 1n) {
      result = edwardsAdd(result, addend);
    }
    addend = edwardsAdd(addend, addend);
    k >>= 1n;
  }
  return result;
}

function isOnCurve(P: [bigint, bigint]): boolean {
  const [x, y] = P;
  const x2 = mod(x * x);
  const y2 = mod(y * y);
  return mod(-x2 + y2 - 1n - mod(D * mod(x2 * y2))) === 0n;
}

function decodePoint(bytes: Uint8Array): [bigint, bigint] | null {
  if (bytes.length !== 32) return null;
  let y = 0n;
  for (let i = 0; i < 31; i++) {
    y |= BigInt(bytes[i]) << BigInt(8 * i);
  }
  y |= BigInt(bytes[31] & 0x7f) << 248n;
  if (y >= Q) return null;

  let x = xRecover(y);
  const xSign = (bytes[31] >> 7) & 1;
  if (Number(x & 1n) !== xSign) {
    if (x === 0n) return null;
    x = Q - x;
  }
  const P: [bigint, bigint] = [x, y];
  if (!isOnCurve(P)) return null;
  return P;
}

function bytesToLittleEndianBigInt(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 0; i < bytes.length; i++) {
    acc |= BigInt(bytes[i]) << BigInt(8 * i);
  }
  return acc;
}

// ============================================================================
// Pure TypeScript FIPS 180-4 SHA-512
// ============================================================================

const SHA512_K: bigint[] = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];

const SHA512_H0: bigint[] = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
];

const MASK_64 = 0xffffffffffffffffn;

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK_64;
}

export function sha512Bytes(msg: Uint8Array): Uint8Array {
  const bitLen = BigInt(msg.length) * 8n;
  const padZeroBytes = (112 - ((msg.length + 1) % 128) + 128) % 128;
  const totalLen = msg.length + 1 + padZeroBytes + 16;
  const padded = new Uint8Array(totalLen);
  padded.set(msg, 0);
  padded[msg.length] = 0x80;

  // 128-bit big-endian bit length at end of padded message
  for (let i = 0; i < 8; i++) {
    padded[totalLen - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);
  }

  const H = [...SHA512_H0];
  const W = new Array<bigint>(80).fill(0n);

  for (let offset = 0; offset < totalLen; offset += 128) {
    for (let i = 0; i < 16; i++) {
      let word = 0n;
      for (let b = 0; b < 8; b++) {
        word = (word << 8n) | BigInt(padded[offset + i * 8 + b]);
      }
      W[i] = word;
    }
    for (let i = 16; i < 80; i++) {
      const s0 = rotr64(W[i - 15], 1n) ^ rotr64(W[i - 15], 8n) ^ (W[i - 15] >> 7n);
      const s1 = rotr64(W[i - 2], 19n) ^ rotr64(W[i - 2], 61n) ^ (W[i - 2] >> 6n);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & MASK_64;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & MASK_64 & g);
      const temp1 = (h + S1 + ch + SHA512_K[i] + W[i]) & MASK_64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & MASK_64;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) & MASK_64;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) & MASK_64;
    }

    H[0] = (H[0] + a) & MASK_64;
    H[1] = (H[1] + b) & MASK_64;
    H[2] = (H[2] + c) & MASK_64;
    H[3] = (H[3] + d) & MASK_64;
    H[4] = (H[4] + e) & MASK_64;
    H[5] = (H[5] + f) & MASK_64;
    H[6] = (H[6] + g) & MASK_64;
    H[7] = (H[7] + h) & MASK_64;
  }

  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    const word = H[i];
    for (let b = 0; b < 8; b++) {
      out[i * 8 + b] = Number((word >> BigInt(56 - 8 * b)) & 0xffn);
    }
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array | null {
  const cleaned = hex.trim().replace(/^ed25519:/i, "");
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    return null;
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    out[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return out;
}

/**
 * Extracts raw 32-byte Ed25519 public key from either:
 * - A 64-hex-char raw 32-byte Ed25519 public key, or
 * - An 88-hex-char RFC 8410 SPKI DER public key (`302a300506032b6570032100` + 32 bytes).
 */
export function normalizeEd25519PublicKeyHex(publicKeyHex: string): string | null {
  const cleaned = (publicKeyHex || "").trim().replace(/^ed25519:/i, "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(cleaned)) {
    return cleaned;
  }
  const spkiPrefix = "302a300506032b6570032100";
  if (cleaned.length === 88 && cleaned.startsWith(spkiPrefix) && /^[0-9a-f]{88}$/.test(cleaned)) {
    return cleaned.slice(spkiPrefix.length);
  }
  return null;
}

/**
 * Pure RFC 8032 Ed25519 public-key signature verification.
 * Accepts UTF-8 message string, 64-byte (128-hex-char) signature, and 32-byte (or SPKI DER) Ed25519 public key.
 */
export function verifyEd25519Signature(
  messageUtf8: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  const normalizedPkHex = normalizeEd25519PublicKeyHex(publicKeyHex);
  if (!normalizedPkHex) return false;

  const pkBytes = hexToBytes(normalizedPkHex);
  const sigBytes = hexToBytes(signatureHex);
  if (!pkBytes || pkBytes.length !== 32 || !sigBytes || sigBytes.length !== 64) {
    return false;
  }

  const rBytes = sigBytes.subarray(0, 32);
  const sBytes = sigBytes.subarray(32, 64);
  const S = bytesToLittleEndianBigInt(sBytes);
  if (S >= L) return false;

  const R = decodePoint(rBytes);
  const A = decodePoint(pkBytes);
  if (!R || !A) return false;

  // Reject small-order / torsion public keys and nonce points (8 * P == identity [0, 1])
  const eightA = scalarMult(A, 8n);
  if (eightA[0] === 0n && eightA[1] === 1n) return false;
  const eightR = scalarMult(R, 8n);
  if (eightR[0] === 0n && eightR[1] === 1n && S === 0n) return false;

  const msgBytes = new TextEncoder().encode(messageUtf8);
  const hashInput = new Uint8Array(32 + 32 + msgBytes.length);
  hashInput.set(rBytes, 0);
  hashInput.set(pkBytes, 32);
  hashInput.set(msgBytes, 64);

  const kDigest = sha512Bytes(hashInput);
  const k = bytesToLittleEndianBigInt(kDigest) % L;

  const lhs = scalarMult(BASE_POINT, S);
  const rhs = edwardsAdd(R, scalarMult(A, k));
  return lhs[0] === rhs[0] && lhs[1] === rhs[1];
}
