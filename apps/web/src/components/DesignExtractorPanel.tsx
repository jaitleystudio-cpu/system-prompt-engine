/**
 * DesignExtractorPanel
 * Production component wrapper in components/ directory for UIDrop Design System Extractor.
 * Dark-mode inspector panel modeled after UIDrop.
 */

import React from "react";
import { UiDropExtractorStudio } from "../engine/UiDropExtractorStudio";

export interface DesignExtractorPanelProps {
  onClose?: () => void;
  defaultUrl?: string;
  isPro?: boolean;
}

export const DesignExtractorPanel: React.FC<DesignExtractorPanelProps> = (props) => {
  return <UiDropExtractorStudio {...props} />;
};

export default DesignExtractorPanel;
export { UiDropExtractorStudio };
