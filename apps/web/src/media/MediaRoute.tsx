import { MEDIA_PRODUCT_MOUNT } from "./mount-contract";
import { MediaProductPanel } from "./MediaProductPanel";
import { pinnedWhisperRuntime } from "./pinnedWhisperRuntime";

/** /media. The route owns the runtime. Callers do not pass another one. */
export function MediaRoute() {
  return (
    <div
      data-shell-mount="media"
      data-shell-mount-sha="a93e87d0efb247204883ecbd18203fe248c5c8e5"
      data-product-media-v1={MEDIA_PRODUCT_MOUNT.productMediaV1}
      data-runtime-owner="route"
    >
      <MediaProductPanel runtime={pinnedWhisperRuntime} />
    </div>
  );
}
