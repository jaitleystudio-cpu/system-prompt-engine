/**
 * TEST FIXTURES ONLY.
 * These documents were produced by G11 export_workflow at
 * 4c916d77b211e2fee33ec1be69c389a8687128a7.
 * They are not a browser runtime binding and they are not a second exporter.
 */
import genericJson from "./fixtures/g11-generic_json.json";
import make from "./fixtures/g11-make.json";
import n8n from "./fixtures/g11-n8n.json";
import zapier from "./fixtures/g11-zapier.json";
import { RUNTIME_BINDING } from "./workflowExportViewModel";

export const WORKFLOW_EXPORT_FIXTURES_ARE = "TEST_FIXTURES_ONLY" as const;
export const WORKFLOW_EXPORT_RUNTIME_BINDING = RUNTIME_BINDING;

export const workflowExportFixtures = [n8n, make, zapier, genericJson] as const;
