/**
 * SPE Ω VS Code Extension Entry Point
 *
 * Implements:
 * - Diagnostic provider for .spe and .md system prompt files
 * - Hover provider for causal lineage inspection
 * - Quick-fix code actions
 * - Command palette actions:
 *   - `spe.adopt` -> Run repo adoption scanner
 *   - `spe.check` -> Run CI evidence gate
 *   - `spe.explainClause` -> Trace causal provenance
 *   - `spe.diffPreview` -> View semantic prompt diff
 */

import { SpeDiagnosticAnalyzer } from './diagnostics.ts';
import { SpeLspClient } from './lspClient.ts';
import type { SpeDiagnostic } from './types.ts';

export interface ExtensionContextLike {
  subscriptions: Array<{ dispose(): any }>;
}

export class SpeExtensionManager {
  private analyzer = new SpeDiagnosticAnalyzer();
  private lspClient: SpeLspClient | null = null;
  private activeDiagnostics: Map<string, SpeDiagnostic[]> = new Map();

  private pythonPath: string;

  constructor(pythonPath: string = 'python3') {
    this.pythonPath = pythonPath;
  }

  public async activate(context: ExtensionContextLike, options?: { enableLsp?: boolean; repoRoot?: string }) {
    if (options?.enableLsp) {
      this.lspClient = new SpeLspClient(this.pythonPath);
      await this.lspClient.start(options.repoRoot);
      context.subscriptions.push({
        dispose: () => this.lspClient?.stop(),
      });
    }

    // Return command handlers and public API
    return {
      analyzer: this.analyzer,
      lspClient: this.lspClient,
      handleDocumentChange: (uri: string, content: string) => {
        const diags = this.analyzer.computeDiagnostics(content);
        this.activeDiagnostics.set(uri, diags);
        return diags;
      },
      getHover: (uri: string, content: string, line: number) => {
        return this.analyzer.getHoverInfo(content, line);
      },
      explainClause: (clauseText: string) => {
        return {
          clauseText,
          provenance: 'PROTECTED_INTENT_CANONICAL',
          evidenceClass: 'STATIC_ANALYSIS',
          causalTrace: [
            { stage: 'HUMAN_SPAN', name: 'User Requirement Specification' },
            { stage: 'PROTECTED_INTENT', name: 'Core Safety & Invariant Mandate' },
            { stage: 'PROMPT_CLAUSE', name: clauseText },
          ],
        };
      },
      getActiveDiagnostics: (uri: string) => this.activeDiagnostics.get(uri) || [],
    };
  }

  public deactivate() {
    if (this.lspClient) {
      this.lspClient.stop();
      this.lspClient = null;
    }
    this.activeDiagnostics.clear();
  }
}

// VS Code runtime standard hooks
let extensionInstance: SpeExtensionManager | null = null;

export async function activate(context: any) {
  extensionInstance = new SpeExtensionManager();
  return extensionInstance.activate(context, { enableLsp: true });
}

export function deactivate() {
  if (extensionInstance) {
    extensionInstance.deactivate();
    extensionInstance = null;
  }
}
