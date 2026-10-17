/**
 * SPE Runtime — MCP (Model Context Protocol) Security Adapter
 * 
 * Intercepts tool calls from MCP clients/servers, validates authority scopes,
 * and blocks unauthorized tools before execution.
 */

import { CapabilityFirewall } from './firewall.ts';
import type { CapabilityType, CapabilityEvaluationResult } from './firewall.ts';

export interface McpToolRequest {
  toolName: string;
  arguments: Record<string, any>;
  serverName?: string;
}

export interface McpToolPolicyRule {
  toolName: string;
  mappedCapability: CapabilityType;
  extractResourceScope: (args: Record<string, any>) => string;
}

export class McpSecurityGateway {
  private firewall: CapabilityFirewall;
  private toolMappings: Map<string, McpToolPolicyRule> = new Map();

  constructor(firewall: CapabilityFirewall) {
    this.firewall = firewall;
    this.registerDefaultToolMappings();
  }

  public registerToolRule(rule: McpToolPolicyRule): void {
    this.toolMappings.set(rule.toolName, rule);
  }

  public evaluateMcpToolCall(request: McpToolRequest): CapabilityEvaluationResult {
    const rule = this.toolMappings.get(request.toolName);

    if (!rule) {
      // If tool is unmapped, evaluate as generic TOOL_EXECUTE
      return this.firewall.evaluateAction('TOOL_EXECUTE', request.toolName);
    }

    const resourceScope = rule.extractResourceScope(request.arguments);
    return this.firewall.evaluateAction(rule.mappedCapability, resourceScope);
  }

  private registerDefaultToolMappings(): void {
    this.registerToolRule({
      toolName: 'read_file',
      mappedCapability: 'READ_FILE',
      extractResourceScope: (args) => args.path || args.file || '*',
    });

    this.registerToolRule({
      toolName: 'write_to_file',
      mappedCapability: 'WRITE_FILE',
      extractResourceScope: (args) => args.TargetFile || args.path || '*',
    });

    this.registerToolRule({
      toolName: 'run_command',
      mappedCapability: 'PRODUCTION_CHANGE',
      extractResourceScope: (args) => args.CommandLine || '*',
    });

    this.registerToolRule({
      toolName: 'query_database',
      mappedCapability: 'DATABASE_READ',
      extractResourceScope: (args) => args.table || args.database || '*',
    });
  }
}
