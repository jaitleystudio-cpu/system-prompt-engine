import { useEffect, useState } from "react";
import { MEDIA_PRODUCT_MOUNT } from "./mount-contract";
import { MediaProductPanel } from "./MediaProductPanel";
import { pinnedWhisperRuntime } from "./pinnedWhisperRuntime";

/**
 * /media. The route owns the runtime. Callers do not pass another one.
 * The product flag starts at the mount ledger (not a pass) and changes only
 * when the existing /api/media route reports the recorded journey.
 */
export function MediaRoute() {
  const [flag, setFlag] = useState<"NOT_PASS" | "PASS">(MEDIA_PRODUCT_MOUNT.productMediaV1);
  const [gap, setGap] = useState<string>(MEDIA_PRODUCT_MOUNT.remainingGap);
  const [source, setSource] = useState<"mount" | "route">("mount");

  useEffect(() => {
    let dead = false;
    async function pull() {
      try {
        const res = await fetch("/api/media/health");
        if (!res.ok) return;
        const body = (await res.json()) as { productMediaV1?: unknown; remainingGap?: unknown };
        if (dead) return;
        const next = body.productMediaV1;
        const nextGap = body.remainingGap;
        if ((next !== "NOT_PASS" && next !== "PASS") || typeof nextGap !== "string" || !nextGap) return;
        setFlag(next);
        setGap(nextGap);
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
      data-claim-source={source}
      data-runtime-owner="route"
    >
      <MediaProductPanel runtime={pinnedWhisperRuntime} />
    </div>
  );
}
