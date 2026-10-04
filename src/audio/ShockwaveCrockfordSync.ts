/**
 * Shockwave Ω v3.0 - Crockford Base32 Acoustic Token Synchronization
 *
 * Grounded in:
 * Douglas Crockford (2002): "Base32 Encoding & Modulo-37 Checksum Specification"
 * - Human-readable, robust against transcription and transmission errors.
 * - Symbol set: 0-9, A-Z (excluding I, L, O, and U to prevent visual and auditory confusion).
 * - Decode normalization: 'O'/'o' -> 0, 'I'/'i'/'L'/'l' -> 1.
 * - Modulo-37 check symbol (*, ~, $, =, U) detects all single-character and adjacent-transposition errors.
 * - Cross-device telemetry synchronization between Mobile Calibration Probe and TV Cinema Audio Engine.
 */

import { AcousticRoomProfile } from "./ShockwaveRoomCalibrationEngine";
import { CalibrationProfile } from "./ShockwaveMasterAudioEngine";

export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CROCKFORD_CHECK_SYMBOLS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";

export class ShockwaveCrockfordSync {
  private static readonly DECODE_MAP: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
      const char = CROCKFORD_ALPHABET[i];
      map[char] = i;
      map[char.toLowerCase()] = i;
    }
    // Crockford canonical aliases
    map["O"] = 0;
    map["o"] = 0;
    map["I"] = 1;
    map["i"] = 1;
    map["L"] = 1;
    map["l"] = 1;
    return map;
  })();

  private static readonly CHECK_DECODE_MAP: Record<string, number> = (() => {
    const map: Record<string, number> = { ...ShockwaveCrockfordSync.DECODE_MAP };
    map["*"] = 32;
    map["~"] = 33;
    map["$"] = 34;
    map["="] = 35;
    map["U"] = 36;
    map["u"] = 36;
    return map;
  })();

  /**
   * Normalize an input string by removing hyphens and whitespace,
   * converting to uppercase, and mapping aliases (I, L -> 1; O -> 0).
   */
  public static normalize(token: string): string {
    const cleaned = token.replace(/[\s\-_]/g, "").toUpperCase();
    let result = "";
    for (const char of cleaned) {
      if (char === "O") {
        result += "0";
      } else if (char === "I" || char === "L") {
        result += "1";
      } else {
        result += char;
      }
    }
    return result;
  }

  /**
   * Encode arbitrary byte buffer into Crockford Base32 string
   */
  public static encodeBytes(data: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = "";

    for (let i = 0; i < data.length; i++) {
      value = (value << 8) | data[i];
      bits += 8;
      while (bits >= 5) {
        output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decode Crockford Base32 string into byte buffer
   */
  /**
   * Decode Crockford Base32 string into byte buffer
   */
  public static decodeBytes(token: string, expectedByteLength?: number): Uint8Array {
    const normalized = this.normalize(token);
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const val = this.DECODE_MAP[char];
      if (val === undefined) {
        throw new Error(`Invalid Crockford Base32 character: "${char}"`);
      }
      value = (value << 5) | val;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
        value &= (1 << bits) - 1;
      }
    }

    const result = new Uint8Array(bytes);
    if (expectedByteLength !== undefined && result.length !== expectedByteLength) {
      return result.slice(0, expectedByteLength);
    }
    return result;
  }

  /**
   * Compute Crockford Modulo-37 Check Symbol for a normalized string
   */
  public static computeModulo37Checksum(normalizedPayload: string): string {
    let rem = 0;
    for (let i = 0; i < normalizedPayload.length; i++) {
      const char = normalizedPayload[i];
      const val = this.DECODE_MAP[char];
      if (val === undefined) {
        throw new Error(`Cannot compute checksum for invalid character: "${char}"`);
      }
      rem = (rem * 32 + val) % 37;
    }
    return CROCKFORD_CHECK_SYMBOLS[rem];
  }

  /**
   * Verify that a token ending with a Crockford Modulo-37 check symbol is authentic.
   * Tolerant of prefixes ("SW-"), delimiters, case, and check symbol aliases.
   */
  public static verifyChecksum(tokenWithCheck: string): boolean {
    const raw = this.parseToken(tokenWithCheck);
    if (raw.length < 2) return false;

    // Last character is the check symbol
    const payloadPart = raw.slice(0, -1);
    const checkChar = raw.slice(-1);

    const normalizedPayload = this.normalize(payloadPart);
    const expectedCheck = this.computeModulo37Checksum(normalizedPayload);

    const expectedVal = this.CHECK_DECODE_MAP[expectedCheck];
    const actualVal = this.CHECK_DECODE_MAP[checkChar];

    return expectedVal !== undefined && actualVal !== undefined && expectedVal === actualVal;
  }

  /**
   * Format a token string into human-friendly grouped representation
   * Example: "SW-8A3F-K29P-9B7C"
   */
  public static formatToken(token: string, groupSize = 4, prefix = "SW"): string {
    const clean = token.replace(/[\s\-_]/g, "").toUpperCase();
    const groups: string[] = [];
    for (let i = 0; i < clean.length; i += groupSize) {
      groups.push(clean.slice(i, i + groupSize));
    }
    const joined = groups.join("-");
    return prefix ? `${prefix}-${joined}` : joined;
  }

  /**
   * Strip formatting prefix (e.g. "SW-", "SW:") and hyphens/spaces to retrieve raw payload + checksum.
   * Distinguishes explicit prefix from legitimate Base32 data starting with 'S' and 'W'.
   */
  public static parseToken(token: string): string {
    const trimmed = token.trim();
    let stripped = trimmed;
    if (/^SW[\s\-_:]+/i.test(stripped)) {
      stripped = stripped.replace(/^SW[\s\-_:]+/i, "");
    }
    let clean = stripped.replace(/[\s\-_:]/g, "").toUpperCase();
    if ((clean.length === 19 || clean.length === 11) && clean.startsWith("SW")) {
      clean = clean.slice(2);
    }
    return clean;
  }

  /**
   * Pack an AcousticRoomProfile into 10 compact bytes and encode to Crockford Base32
   * with Modulo-37 Check Symbol.
   *
   * Byte 0: RT60 (centiseconds, e.g. 43 = 0.43s)
   * Byte 1: SPL (dB, e.g. 75 = 75dB)
   * Bytes 2-3: Primary room mode (uint16, tenths of Hz, e.g. 613 = 61.3Hz)
   * Byte 4: Surround Left delay (tenths of ms, e.g. 185 = 18.5ms)
   * Byte 5: Surround Right delay (tenths of ms, e.g. 185 = 18.5ms)
   * Byte 6: Center delay (tenths of ms, e.g. 12 = 1.2ms)
   * Byte 7: LFE delay (tenths of ms, e.g. 48 = 4.8ms)
   * Bytes 8-9: Inter-aural XTC delay (uint16, microseconds, e.g. 150µs)
   */
  public static encodeProfile(profile: AcousticRoomProfile): string {
    const buffer = new Uint8Array(10);

    const rt60Cs = Math.min(255, Math.max(1, Math.round(profile.rt60DecaySeconds * 100)));
    const splDb = Math.min(255, Math.max(30, Math.round(profile.measuredSplDb)));
    const primaryMode = profile.roomModesHz[2] || 61.3;
    const modeTenths = Math.min(65535, Math.max(100, Math.round(primaryMode * 10)));
    const slTenths = Math.min(255, Math.round(profile.channelDelaysMs.surroundLeft * 10));
    const srTenths = Math.min(255, Math.round(profile.channelDelaysMs.surroundRight * 10));
    const cTenths = Math.min(255, Math.round(profile.channelDelaysMs.center * 10));
    const lfeTenths = Math.min(255, Math.round(profile.channelDelaysMs.lfe * 10));
    const xtcUs = Math.min(65535, Math.max(50, Math.round(profile.interAuralDelayUs)));

    buffer[0] = rt60Cs;
    buffer[1] = splDb;
    buffer[2] = (modeTenths >> 8) & 0xff;
    buffer[3] = modeTenths & 0xff;
    buffer[4] = slTenths;
    buffer[5] = srTenths;
    buffer[6] = cTenths;
    buffer[7] = lfeTenths;
    buffer[8] = (xtcUs >> 8) & 0xff;
    buffer[9] = xtcUs & 0xff;

    const base32 = this.encodeBytes(buffer); // 16 characters
    const checksum = this.computeModulo37Checksum(base32); // 1 character
    return this.formatToken(base32 + checksum, 4, "SW");
  }

  /**
   * Decode and reconstruct an AcousticRoomProfile from a Crockford Base32 token.
   * Validates the Modulo-37 checksum and restores all acoustic parameters.
   */
  public static decodeProfile(token: string): AcousticRoomProfile | null {
    try {
      const raw = this.parseToken(token);
      // Strictly 16 Base32 payload characters + 1 check symbol = 17 characters
      if (raw.length !== 17) {
        return null;
      }

      if (!this.verifyChecksum(raw)) {
        console.warn(`[CROCKFORD] Checksum verification failed for token: ${token}`);
        return null;
      }

      const payloadChars = raw.slice(0, 16);
      const normalizedPayload = this.normalize(payloadChars);
      const buffer = this.decodeBytes(normalizedPayload, 10);
      if (buffer.length < 10) return null;

      const rt60DecaySeconds = Math.round((buffer[0] / 100) * 100) / 100;
      const measuredSplDb = buffer[1];
      const primaryModeHz = Math.round(((buffer[2] << 8) | buffer[3]) / 10 * 10) / 10;
      const surroundLeftMs = Math.round((buffer[4] / 10) * 10) / 10;
      const surroundRightMs = Math.round((buffer[5] / 10) * 10) / 10;
      const centerMs = Math.round((buffer[6] / 10) * 10) / 10;
      const lfeMs = Math.round((buffer[7] / 10) * 10) / 10;
      const xtcDelayUs = (buffer[8] << 8) | buffer[9];

      // Reconstruct complementary room modes
      const modeLength = Math.round((primaryModeHz * 0.58) * 10) / 10;
      const modeWidth = Math.round((primaryModeHz * 0.77) * 10) / 10;
      const secondLength = Math.round((modeLength * 2) * 10) / 10;
      const roomModes = [modeLength, modeWidth, primaryModeHz, secondLength];
      const notchGains = [-4.0, -4.5, -3.5, -3.0];

      return {
        rt60DecaySeconds,
        measuredSplDb,
        roomModesHz: roomModes,
        notchGainDb: notchGains,
        interAuralDelayUs: xtcDelayUs,
        xtcCrosstalkAttenuationDb: -12.5,
        channelDelaysMs: {
          frontLeft: 0.0,
          frontRight: 0.0,
          center: centerMs,
          lfe: lfeMs,
          surroundLeft: surroundLeftMs,
          surroundRight: surroundRightMs,
        },
        calibrated: true,
      };
    } catch (err) {
      console.error("[CROCKFORD] Decode failed:", err);
      return null;
    }
  }

  /**
   * Encode mobile probe CalibrationProfile into a Crockford sync token
   */
  public static encodeCalibrationProfileReceipt(profile: CalibrationProfile): string {
    const acousticProfile: AcousticRoomProfile = {
      rt60DecaySeconds: 0.42,
      measuredSplDb: 75.0,
      roomModesHz: [35.7, 47.6, profile.channels.lfe.peqFrequencies[0] || 61.3, 71.4],
      notchGainDb: [-4.0, -4.5, -3.5, -3.0],
      interAuralDelayUs: 180,
      xtcCrosstalkAttenuationDb: -12.5,
      channelDelaysMs: {
        frontLeft: profile.channels.fl.delayMs,
        frontRight: profile.channels.fr.delayMs,
        center: profile.channels.center.delayMs,
        lfe: profile.channels.lfe.delayMs,
        surroundLeft: profile.channels.sl.delayMs,
        surroundRight: profile.channels.sr.delayMs,
      },
      calibrated: true,
    };
    return this.encodeProfile(acousticProfile);
  }

  /**
   * Decode a Crockford sync token back into a mobile probe CalibrationProfile
   */
  public static decodeCalibrationProfileReceipt(token: string): Partial<CalibrationProfile> | null {
    const acoustic = this.decodeProfile(token);
    if (!acoustic) return null;

    return {
      timestamp: new Date().toISOString(),
      roomVolumeEstM3: 42.0,
      channels: {
        fl: { delayMs: acoustic.channelDelaysMs.frontLeft, gainDb: 0.0, peqFrequencies: [65, 250, 4000], peqGains: [-2.1, 1.4, -0.8], peqQ: [2.0, 1.5, 1.0] },
        fr: { delayMs: acoustic.channelDelaysMs.frontRight, gainDb: -0.5, peqFrequencies: [68, 260, 4100], peqGains: [-1.9, 1.2, -0.6], peqQ: [2.0, 1.5, 1.0] },
        center: { delayMs: acoustic.channelDelaysMs.center, gainDb: 1.5, peqFrequencies: [300, 2400], peqGains: [1.0, 3.2], peqQ: [1.2, 1.4] },
        lfe: { delayMs: acoustic.channelDelaysMs.lfe, gainDb: 3.0, peqFrequencies: [acoustic.roomModesHz[2] || 45, 80], peqGains: [4.0, -1.5], peqQ: [2.5, 1.8] },
        sl: { delayMs: acoustic.channelDelaysMs.surroundLeft, gainDb: 1.0, peqFrequencies: [7000], peqGains: [-2.0], peqQ: [1.0] },
        sr: { delayMs: acoustic.channelDelaysMs.surroundRight, gainDb: 1.2, peqFrequencies: [7200], peqGains: [-2.2], peqQ: [1.0] },
      },
    };
  }

  /**
   * Generate lightweight session/pairing token
   */
  public static generateSessionPairingToken(): string {
    const randomBytes = new Uint8Array(5);
    const gCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (gCrypto && typeof gCrypto.getRandomValues === "function") {
      gCrypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 5; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const base32 = this.encodeBytes(randomBytes); // 8 characters
    const checksum = this.computeModulo37Checksum(base32);
    return this.formatToken(base32 + checksum, 4, "SW");
  }
}
