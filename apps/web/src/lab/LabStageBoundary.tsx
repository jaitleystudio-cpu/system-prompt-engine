import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; title?: string };
type State = { failed: boolean };

/**
 * Soft boundary so a WebGL/Canvas failure cannot blank Daily Lab
 * editorial + Open in SPE acquisition CTAs.
 */
export class LabStageBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          className="spe-lab-stage spe-lab-stage-fallback"
          role="img"
          aria-label={
            this.props.title
              ? `3D preview unavailable: ${this.props.title}`
              : "3D preview unavailable"
          }
        >
          3D preview unavailable on this device — the build prompt below still
          opens in Create.
        </div>
      );
    }
    return this.props.children;
  }
}
