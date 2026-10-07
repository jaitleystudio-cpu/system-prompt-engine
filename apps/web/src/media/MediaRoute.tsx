import { useEffect, useState } from "react";
import { MEDIA_PRODUCT_MOUNT } from "./mount-contract";
import { MediaProductPanel } from "./MediaProductPanel";
import { pinnedWhisperRuntime } from "./pinnedWhisperRuntime";

/**
 * Accept a /api/media/health body as a route claim. The route is an evidence
 * writer: only productMediaV1 NOT_PASS is ever accepted. A body that claims a
 * pass is ignored, so the UI can never promote writer evidence. runtimeJourney
 * is informational (runtime evidence complete), not a product pass.
 */
export function readRouteClaim(
  body: unknown,
): { flag: "NOT_PASS"; gap: string; runtimeJourney: string } | null {
  if (body === null || body === undefined) return null;
  const claim = body as { productMediaV1?: unknown; remainingGap?: unknown; runtimeJourney?: unknown };
  const next = claim.productMediaV1;
  const nextGap = claim.remainingGap;
  if (next !== "NOT_PASS" || typeof nextGap !== "string" || !nextGap) return null;
  const runtimeJourney = typeof claim.runtimeJourney === "string" ? claim.runtimeJourney : "";
  return { flag: next, gap: nextGap, runtimeJourney };
}

/**
 * /media. The route owns the runtime. Callers do not pass another one.
 * The product flag starts at the mount ledger (not a pass) and stays NOT_PASS;
 * the existing /api/media route may only update the remaining gap and the
 * informational runtime-journey state.
 */
export function MediaRoute() {
  const [flag, setFlag] = useState<"NOT_PASS">(MEDIA_PRODUCT_MOUNT.productMediaV1);
  const [gap, setGap] = useState<string>(MEDIA_PRODUCT_MOUNT.remainingGap);
  const [runtimeJourney, setRuntimeJourney] = useState<string>("");
  const [source, setSource] = useState<"mount" | "route">("mount");

  useEffect(() => {
    let dead = false;
    async function pull() {
      try {
        const res = await fetch("/api/media/health");
        if (!res.ok) return;
        const body: unknown = await res.json();
        if (dead) return;
        const claim = readRouteClaim(body);
        if (!claim) return;
        setFlag(claim.flag);
        setGap(claim.gap);
        setRuntimeJourney(claim.runtimeJourney);
        setSource("route");
      } catch {
        /* file harness has no host; the ledger value stands */
      }
    }
    void pull();
    const timer = setInterval(() => void pull(), 1000);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      data-shell-mount="media"
      data-shell-mount-sha="a93e87d0efb247204883ecbd18203fe248c5c8e5"
      data-product-media-v1={flag}
      data-remaining-gap={gap}
      data-runtime-journey={runtimeJourney || undefined}
      data-claim-source={source}
      data-runtime-owner="route"
    >
      <MediaProductPanel runtime={pinnedWhisperRuntime} />
    </div>
  );
}
