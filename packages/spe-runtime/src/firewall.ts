/**
 * SPE Runtime — Zero-Dependency Capability Firewall
 * 
 * Enforces principle of least authority (PoLA) over AI actions:
 * An AI model can never self-authorize permissions to the physical world.
 */

export type CapabilityType =
  | 'READ_FILE'
  | 'WRITE_FILE'
  | 'DELETE_FILE'
  | 'NETWORK'
  | 'SEND_EMAIL'
  | 'CALENDAR_READ'
  | 'CALENDAR_WRITE'
  | 'DATABASE_READ'
  | 'DATABASE_WRITE'
  | 'SECRET_READ'
  | 'GIT_COMMIT'
  | 'GIT_PUSH'
  | 'DEPLOY'
  | 'PRODUCTION_CHANGE'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'TOOL_EXECUTE';

export type CapabilityDecision = 'ALLOW' | 'DENY' | 'REQUIRES_APPROVAL';

export interface CapabilityGrant {
  grantId: string;
  capability: CapabilityType;
  resourceScope: string; // glob or exact path/uri, e.g. "docs/*"
  actionScope?: string;   // e.g. "SELECT", "INSERT"
  issuer: string;         // e.g. "human-operator", "org-policy"
  expiresAt?: string;     // ISO timestamp
  approvalRequired?: boolean;
}

export interface CapabilityEvaluationResult {
  decision: CapabilityDecision;
  capability: CapabilityType;
  resourceScope: string;
  reason: string;
  grantId?: string;
  timestamp: string;
}

export class CapabilityFirewall {
  private grants: Map<string, CapabilityGrant> = new Map();

  constructor(initialGrants: CapabilityGrant[] = []) {
    for (const g of initialGrants) {
      this.grants.set(g.grantId, g);
    }
  }

  public addGrant(grant: CapabilityGrant): void {
    this.grants.set(grant.grantId, grant);
  }

  public revokeGrant(grantId: string): boolean {
    return this.grants.delete(grantId);
  }

  public listGrants(): CapabilityGrant[] {
    return Array.from(this.grants.values());
  }

  public evaluateAction(
    capability: CapabilityType,
    resource: string,
    actionScope?: string
  ): CapabilityEvaluationResult {
    const now = new Date().toISOString();

    for (const grant of this.grants.values()) {
      // 1. Check Capability Match
      if (grant.capability !== capability) continue;

      // 2. Check Expiration
      if (grant.expiresAt && grant.expiresAt < now) {
        continue; // Expired
      }

      // 3. Check Resource Scope match (exact or wildcard prefix)
      const matchesScope = this.matchesResourceScope(grant.resourceScope, resource);
      if (!matchesScope) continue;

      // 4. Check Action Scope match if specified
      if (grant.actionScope && actionScope && grant.actionScope !== actionScope) {
        continue;
      }

      // 5. Match Found!
      if (grant.approvalRequired) {
        return {
          decision: 'REQUIRES_APPROVAL',
          capability,
          resourceScope: resource,
          reason: `Action permitted but policy requires explicit human confirmation for '${resource}'`,
          grantId: grant.grantId,
          timestamp: now,
        };
      }

      return {
        decision: 'ALLOW',
        capability,
        resourceScope: resource,
        reason: `Authorized by grant '${grant.grantId}' issued by '${grant.issuer}'`,
        grantId: grant.grantId,
        timestamp: now,
      };
    }

    // Default Deny
    return {
      decision: 'DENY',
      capability,
      resourceScope: resource,
      reason: `No valid capability grant authorized '${capability}' on resource '${resource}'`,
      timestamp: now,
    };
  }

  private matchesResourceScope(pattern: string, resource: string): boolean {
    if (pattern === '*' || pattern === resource) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return resource.startsWith(prefix);
    }
    return false;
  }
}
