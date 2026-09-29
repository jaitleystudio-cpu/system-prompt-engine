/** Streaming intake worker. OPFS custody only. No semantic engine, XCAT, K3, or quality import. */

import { PROTOCOL } from "./constants.mjs";
import { MassiveError } from "./errors.mjs";
import { openBrowserRoot } from "./opfsStore.mjs";
import { handleIngestMessage } from "./protocol.mjs";

const host = {
  kind: "opfs",
  custody: null,
  sessions: new Map(),
  index: null,
  pressure: null,
};

async function readyHost() {
  if (!host.custody) host.custody = await openBrowserRoot();
  return host;
}

self.onmessage = (event) => {
  readyHost()
    .then((live) => handleIngestMessage(live, event.data))
    .then((reply) => {
      self.postMessage(reply);
    })
    .catch((error) => {
      const massive = error instanceof MassiveError;
      self.postMessage({
        protocol: PROTOCOL,
        ok: false,
        code: massive ? error.code : "FAILED",
        reason: massive ? error.reason : "ingest failed",
        silent_truncation: false,
        semantic_judgment: "NOT_A_PASS",
        semantic_engine: "NOT_INTEGRATED",
      });
    });
};
