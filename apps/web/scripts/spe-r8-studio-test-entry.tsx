import React from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "../src/website-studio/Studio.tsx";
import { createDefaultWebsiteSpecV2 } from "../src/website-studio/model/websiteSpecV2.ts";
import type { TrustedR8Reviewer } from "../src/website-studio/recovery/trustedReceiptReview.ts";

/** CI-ONLY compiled reviewer policy; NOT a production key or public route. */
declare const __SPE_R8_TEST_TRUST__: TrustedR8Reviewer;
const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(
    <Studio initialSpec={createDefaultWebsiteSpecV2()}
      trustedRecoveryReviewer={__SPE_R8_TEST_TRUST__} />
  );
}
