import { useId } from "react";

type DotPatternProps = {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
  surface?: "hero" | "create";
};

type LayerProps = {
  id: string;
  className: string;
  width: number;
  height: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  cr: number;
};

function PatternLayer({
  id,
  className,
  width,
  height,
  x,
  y,
  cx,
  cy,
  cr,
}: LayerProps) {
  return (
    <svg className={className}>
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          x={x}
          y={y}
          patternUnits="userSpaceOnUse"
        >
          <circle className="spe-dot-pattern__dot" cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function DotPattern({
  width = 22,
  height = 22,
  x = 0,
  y = 0,
  cx = 1.2,
  cy = 1.2,
  cr = 1.05,
  className = "",
  surface = "hero",
}: DotPatternProps) {
  const seed = useId().replaceAll(":", "");
  const classes = [
    "spe-dot-pattern",
    `spe-dot-pattern--${surface}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-surface={surface} aria-hidden="true">
      <PatternLayer
        id={`${seed}-primary`}
        className="spe-dot-pattern__layer spe-dot-pattern__layer--primary"
        width={width}
        height={height}
        x={x}
        y={y}
        cx={cx}
        cy={cy}
        cr={cr}
      />
      <PatternLayer
        id={`${seed}-secondary`}
        className="spe-dot-pattern__layer spe-dot-pattern__layer--secondary"
        width={width * 1.85}
        height={height * 1.85}
        x={x + width * 0.42}
        y={y + height * 0.3}
        cx={cx}
        cy={cy}
        cr={Math.max(1.15, cr * 1.18)}
      />
      <PatternLayer
        id={`${seed}-tertiary`}
        className="spe-dot-pattern__layer spe-dot-pattern__layer--tertiary"
        width={width * 3.4}
        height={height * 3.4}
        x={x + width}
        y={y + height * 0.72}
        cx={cx}
        cy={cy}
        cr={Math.max(1.6, cr * 1.55)}
      />
      <span className="spe-dot-pattern__haze" />
      <span className="spe-dot-pattern__vignette" />
    </div>
  );
}
