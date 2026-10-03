/**
 * Media mount-contract.ts is not in this tree.
 * Fail closed. This is not a media product.
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
        This address is reserved. No media product is mounted, so nothing here
        can capture, transcribe, or generate media.
      </p>
    </section>
  );
}
