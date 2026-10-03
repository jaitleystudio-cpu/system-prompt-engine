import assert from "node:assert/strict";
import test from "node:test";
import { classifyRequest, judgeEgress } from "../../tools/r3g/classify_egress.mjs";

const CANARY = "SPE-R3G-CANARY-test";

test("loopback wasm fetch without the canary is asset traffic on device", () => {
  assert.equal(
    classifyRequest({
      url: "http://127.0.0.1:5199/spe_wasm.wasm",
      postData: "",
      resourceType: "other",
    }, [CANARY]),
    "loopback_asset",
  );
});

test("an external model download without the canary is asset ingress, not raw egress", () => {
  assert.equal(
    classifyRequest({
      url: "https://cdn.example/models/encoder.onnx",
      postData: "",
      resourceType: "other",
    }, [CANARY]),
    "asset_ingress",
  );
});

test("canary bytes on a non-loopback request are raw user-data egress", () => {
  assert.equal(
    classifyRequest({
      url: "https://collector.example/v1/event",
      postData: JSON.stringify({ prompt: CANARY }),
      resourceType: "fetch",
    }, [CANARY]),
    "raw_user_data_egress",
  );
});

test("a canary that only hits loopback did not leave the device", () => {
  assert.equal(
    classifyRequest({
      url: "http://127.0.0.1:5199/__r3g/harness.html?canary=" + CANARY,
      postData: "",
      resourceType: "document",
    }, [CANARY]),
    "loopback_with_canary",
  );
});

test("unmeasured zero counts are not a privacy pass", () => {
  const verdict = judgeEgress({
    measured: false,
    engineOk: false,
    flowsExecuted: [],
    requests: [],
  });
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.equal(verdict.pass, false);
  assert.equal(verdict.zero_egress, false);
  assert.ok(verdict.reasons.includes("unmeasured"));
  assert.ok(verdict.reasons.includes("engine_not_ok"));
});

test("executed prompt compile with no raw egress still HOLDs while other modalities were not run", () => {
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    flowsExecuted: ["prompt"],
    requests: [
      { class: "loopback_asset" },
      { class: "loopback_with_canary" },
    ],
  });
  assert.equal(verdict.raw_user_data_egress, false);
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.match(verdict.reasons.join(" "), /modalities_not_executed/);
  assert.match(verdict.reasons.join(" "), /audio/);
  assert.equal(verdict.field_cwv, "UNKNOWN");
});

test("raw egress is HOLD even if every modality was claimed", () => {
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    flowsExecuted: ["prompt", "transcript", "image", "audio", "video", "code", "document"],
    requests: [{ class: "raw_user_data_egress" }],
  });
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.equal(verdict.raw_user_data_egress, true);
});
