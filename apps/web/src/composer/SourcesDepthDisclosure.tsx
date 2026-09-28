import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** When true (Create view), collapse by default on narrow viewports. */
  progressive?: boolean;
};

/**
 * Progressive disclosure for Sources & depth.
 * Native <details>/<summary> — keyboard accessible, aria-expanded via UA,
 * selected control state preserved while collapsed (ADS: prefer semantic HTML).
 */
export function SourcesDepthDisclosure({
  children,
  progressive = true,
}: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined" || !progressive) return true;
    return window.matchMedia("(min-width: 901px)").matches;
  });
  const [userTouched, setUserTouched] = useState(false);

  useEffect(() => {
    if (!progressive || userTouched) return;
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => setOpen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [progressive, userTouched]);

  if (!progressive) {
    return <div className="spe-create-sources-body">{children}</div>;
  }

  return (
    <details
      className="spe-create-sources-depth"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        setUserTouched(true);
        setOpen(next);
      }}
    >
      <summary className="spe-create-sources-summary">
        <span className="spe-create-sources-title">Sources &amp; depth</span>
        <span className="spe-create-sources-hint">
          Source policy · Automatic · Fast · Smart · Deep
        </span>
      </summary>
      <div className="spe-create-sources-body">{children}</div>
    </details>
  );
}
