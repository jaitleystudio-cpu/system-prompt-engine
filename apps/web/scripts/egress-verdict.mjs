/**
 * Measurement vs permission for one SPE evaluate result.
 * zero_egress is a count. It is not permission to send bytes.
 * Raw private bytes are never outbound-safe.
 * A missing consent field is not an allow.
 * Fixture expect PASS is not a privacy qualification.
 * COST ₹0.
 */

export function classifyEgress(result) {
  const record = result && typeof result === "object" ? result : {};
  const egress = record.egress && typeof record.egress === "object" ? record.egress : {};
  const fetchCount = egress.fetch_during_evaluate;
  const wsCount = egress.websocket_during_evaluate;
  const measured =
    egress.measured !== false &&
    Number.isInteger(fetchCount) &&
    Number.isInteger(wsCount);
  const engineFailed = record.error != null;
  const zeroEgress =
    measured &&
    !engineFailed &&
    record.used_ts_fallback !== true &&
    fetchCount === 0 &&
    wsCount === 0;
  const consent = record.consent;
  const consentPresent = consent === true || consent === "GRANTED";
  return {
    zero_egress: zeroEgress,
    outbound_safe: false,
    consent_present: consentPresent,
    missing_consent_allows_egress: false,
    privacy_qualification: "NOT_A_PASS",
  };
}
