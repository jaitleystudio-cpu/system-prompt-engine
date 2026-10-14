/**
 * DesignExtractorPanel component wrapper
 * Re-exports UiDropExtractorStudio for the components directory.
 */

import React from "react";
import { UiDropExtractorStudio } from "../engine/UiDropExtractorStudio";

export const DesignExtractorPanel: React.FC<{
  onClose?: () => void;
  defaultUrl?: string;
  isPro?: boolean;
}> = (props) => {
  return <UiDropExtractorStudio {...props} />;
};

export default DesignExtractorPanel;
