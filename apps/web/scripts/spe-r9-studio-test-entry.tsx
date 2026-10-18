import React from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "../src/website-studio/Studio.tsx";
import { createDefaultWebsiteSpecV2 } from "../src/website-studio/model/websiteSpecV2.ts";
import type { TrustedR9PolicyAnchor } from "../src/website-studio/recovery/reviewerTrustPolicy.ts";

/** Only a CI-generated root anchor: NOT a production key or public route. */
declare const __SPE_R9_CI_ANCHOR__: TrustedR9PolicyAnchor;
const root = document.getElementById("root");
if (root) createRoot(root).render(
  <Studio initialSpec={createDefaultWebsiteSpecV2()}
    trustedRecoveryPolicyAnchor={__SPE_R9_CI_ANCHOR__} />
);
