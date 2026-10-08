/**
 * Data sources and privacy boundary definitions.
 */
import type { DataSource, PrivacyBoundary } from "../model/dataBinding.ts";

export interface DataSourceDefinition {
  type: DataSource;
  privacyBoundary: PrivacyBoundary;
  description: string;
}

export const DATA_SOURCES: Record<DataSource, DataSourceDefinition> = {
  LOCAL_CONSTANT: {
    type: "LOCAL_CONSTANT",
    privacyBoundary: "LOCAL",
    description: "Static constant value baked into the project."
  },
  LOCAL_PROJECT_DATA: {
    type: "LOCAL_PROJECT_DATA",
    privacyBoundary: "LOCAL",
    description: "Local client-side reactive state or form field."
  },
  PUBLIC_FETCH: {
    type: "PUBLIC_FETCH",
    privacyBoundary: "PUBLIC_FETCH",
    description: "Public anonymous HTTP/REST endpoint (no authentication tokens sent)."
  },
  EXTERNAL_PROVIDER: {
    type: "EXTERNAL_PROVIDER",
    privacyBoundary: "EXTERNAL_PROVIDER",
    description: "Authenticated external API or third-party service."
  }
};
