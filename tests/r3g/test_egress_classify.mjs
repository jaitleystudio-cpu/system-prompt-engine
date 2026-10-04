import assert from "node:assert/strict";
import test from "node:test";
import { classifyRequest, describeRequest, externalHosts, judgeEgress } from "../../tools/r3g/classify_egress.mjs";

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

test("an external model download without the canary is a user-authorized model download, not raw egress", () => {
  const described = describeRequest({
    url: "https://cdn.example/models/encoder.onnx",
    method: "GET",
    postData: "",
    resourceType: "other",
    initiator: "script",
  }, [CANARY]);
  assert.equal(described.class, "user_authorized_model_download");
  assert.equal(described.payload_class, "model_bytes");
  assert.equal(described.allowed_reason, "user_authorized_model_download");
  assert.equal(described.host, "cdn.example");
  assert.equal(described.method, "GET");
  assert.equal(described.initiator, "script");
  assert.equal(classifyRequest({
    url: "https://cdn.example/models/encoder.onnx",
    postData: "",
    resourceType: "other",
  }, [CANARY]), "user_authorized_model_download");
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    flowsExecuted: ["prompt"],
    requests: [{ ...described, path: "/models/encoder.onnx" }],
  });
  assert.equal(verdict.raw_user_data_egress, false);
  assert.equal(verdict.user_authorized_model_download, 1);
  assert.equal(verdict.pass, false);
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

test("localhost is not an external host", () => {
  assert.equal(
    classifyRequest({
      url: "http://localhost:5199/spe_wasm.wasm",
      method: "GET",
      postData: "",
      resourceType: "other",
    }, [CANARY]),
    "loopback_asset",
  );
  const hosts = externalHosts([
    { class: "external_other", host: "localhost", path: "/mutant" },
    { class: "raw_user_data_egress", host: "127.0.0.1", url: "http://127.0.0.1/x", path: "/x" },
    { class: "external_other", host: "collector.example", path: "/v1" },
  ]);
  assert.deepEqual(hosts, ["external_other collector.example/v1"]);
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    flowsExecuted: ["prompt"],
    requests: [{ class: "external_other", host: "localhost", path: "/mutant" }],
  });
  assert.equal(verdict.external_other, 0);
  assert.equal(verdict.external_hosts.length, 0);
  assert.equal(verdict.reasons.includes("unexplained_external"), false);
});

test("a model download is not a raw media upload", () => {
  const upload = describeRequest({
    url: "https://cdn.example/models/encoder.onnx",
    method: "POST",
    postData: "raw-image-bytes-not-a-model",
    resourceType: "fetch",
    initiator: "script",
  }, [CANARY]);
  assert.equal(upload.class, "raw_user_data_egress");
  assert.equal(upload.payload_class, "media_upload");
  assert.notEqual(upload.class, "user_authorized_model_download");
});

test("missing WASM is not a privacy pass", () => {
  const verdict = judgeEgress({
    measured: true,
    engineOk: false,
    missingWasm: true,
    flowsExecuted: ["prompt", "transcript", "image", "audio", "video", "code", "document"],
    requests: [],
  });
  assert.equal(verdict.pass, false);
  assert.equal(verdict.zero_egress, false);
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.ok(verdict.reasons.includes("missing_wasm_not_privacy_pass"));
  assert.notEqual(verdict.privacy_qualification, "PASS");
});

test("fixture fetch is not a privacy pass", () => {
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    fixtureOnly: true,
    flowsExecuted: ["prompt", "transcript", "image", "audio", "video", "code", "document"],
    requests: [{ class: "loopback_asset", host: "127.0.0.1", path: "/src/samples/pos001.json", payload_class: "fixture" }],
  });
  assert.equal(verdict.pass, false);
  assert.equal(verdict.zero_egress, false);
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.ok(verdict.reasons.includes("fixture_fetch_not_privacy_pass"));
});

test("a network error is not privacy proof", () => {
  const verdict = judgeEgress({
    measured: true,
    engineOk: true,
    networkError: true,
    flowsExecuted: ["prompt", "transcript", "image", "audio", "video", "code", "document"],
    requests: [{ class: "network_error", host: "collector.example", path: "/v1", url: "https://collector.example/v1" }],
  });
  assert.equal(verdict.pass, false);
  assert.equal(verdict.zero_egress, false);
  assert.equal(verdict.privacy_qualification, "HOLD");
  assert.ok(verdict.reasons.includes("network_error_not_privacy_proof"));
  assert.equal(verdict.raw_user_data_egress, false);
});
