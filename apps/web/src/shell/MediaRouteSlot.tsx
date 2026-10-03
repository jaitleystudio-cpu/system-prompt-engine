/**
 * Media UI is frozen at a93e87d0 and is not mounted in this commit.
 * Fail closed. This is not a media product. PRODUCT_MEDIA_V1 is NOT_PASS.
 * LOCAL_NEURAL is not run in the browser from this route.
 */
export const MEDIA_MOUNT = "MOUNT_PENDING" as const;

export function MediaRouteSlot() {
  return (
    <section
      className="spe-mount-pending"
      data-shell-mount="media"
      data-mount-state={MEDIA_MOUNT}
      aria-labelledby="media-unavailable-title"
    >
      <p className="spe-kicker">Not in this build</p>
      <h1 id="media-unavailable-title">Media is not available</h1>
      <p>
        This address is reserved. MediaProductPanel from a93e87d0 is not
        mounted here. LOCAL_NEURAL is unavailable in the browser on this route.
        Nothing here captures, transcribes, or generates media.
      </p>
    </section>
  );
}
