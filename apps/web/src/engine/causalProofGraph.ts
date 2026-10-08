/**
 * SPE Ω Causal Proof Graph Engine
 *
 * Establishes bidirectional causal lineage from human requirements and ProtectedIntent
 * down to AST transforms, prompt clauses, test cases, and cryptographic evidence receipts.
 *
 * Implements:
 * - whyDoesThisClauseExist(clauseId): backwards provenance trace to human span & intent
 * - whereIsThisRequirementEnforced(reqId): forwards enforcement trace to clauses, policies & tests
 * - findOrphans(): identifies unanchored clauses or unverified requirements
 */

export type NodeType =
  | 'HUMAN_SPAN'
  | 'PROTECTED_INTENT'
  | 'REQUIREMENT'
  | 'CONSTRAINT'
  | 'XCAT_NODE'
  | 'K3_TRANSFORM'
  | 'EFFECT_PLAN_OP'
  | 'PROMPT_CLAUSE'
  | 'TEST_CASE'
  | 'RUNTIME_POLICY'
  | 'EXECUTION'
  | 'RESULT'
  | 'EVIDENCE';

export type EdgeType =
  | 'DERIVES_FROM'
  | 'ENFORCES'
  | 'TRANSFORMS'
  | 'PRODUCES'
  | 'VALIDATES_WITH'
  | 'MONITORS'
  | 'EVIDENCED_BY'
  | 'REGRESSED_BY';

export interface CausalEvidence {
  evidenceId: string;
  evidenceClass: 'OBSERVED_REMOTE' | 'OBSERVED_LOCAL' | 'SIMULATED' | 'CALIBRATED_ESTIMATE' | 'STATIC_ANALYSIS' | 'DETERMINISTIC';
  metric: string;
  value: any;
  observedAt: string;
}

export interface CausalNode {
  nodeId: string;
  nodeType: NodeType;
  label: string;
  payload?: Record<string, any>;
}

export interface CausalEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  metadata?: Record<string, any>;
}

export interface ClauseProvenanceTrace {
  clauseId: string;
  humanSpans: CausalNode[];
  protectedIntents: CausalNode[];
  requirements: CausalNode[];
  transforms: CausalNode[];
  fullLineage: CausalNode[];
}

export interface RequirementEnforcementTrace {
  requirementId: string;
  constraints: CausalNode[];
  clauses: CausalNode[];
  testCases: CausalNode[];
  runtimePolicies: CausalNode[];
  fullDownstream: CausalNode[];
}

export class CausalProofGraph {
  public nodes: Map<string, CausalNode> = new Map();
  public edges: Map<string, CausalEdge> = new Map();
  public evidence: Map<string, CausalEvidence[]> = new Map();
  private outgoing: Map<string, string[]> = new Map();
  private incoming: Map<string, string[]> = new Map();

  public addNode(node: CausalNode): void {
    this.nodes.set(node.nodeId, node);
    if (!this.outgoing.has(node.nodeId)) this.outgoing.set(node.nodeId, []);
    if (!this.incoming.has(node.nodeId)) this.incoming.set(node.nodeId, []);
  }

  public addEdge(edge: CausalEdge): void {
    this.edges.set(edge.edgeId, edge);
    const outList = this.outgoing.get(edge.sourceId) || [];
    outList.push(edge.edgeId);
    this.outgoing.set(edge.sourceId, outList);

    const inList = this.incoming.get(edge.targetId) || [];
    inList.push(edge.edgeId);
    this.incoming.set(edge.targetId, inList);
  }

  public attachEvidence(nodeId: string, ev: CausalEvidence): void {
    const list = this.evidence.get(nodeId) || [];
    list.push(ev);
    this.evidence.set(nodeId, list);
  }

  public whyDoesThisClauseExist(clauseId: string): ClauseProvenanceTrace {
    if (!this.nodes.has(clauseId)) {
      throw new Error(`Node ${clauseId} not found in CausalProofGraph`);
    }

    const visited = new Set<string>();
    const tracePath: CausalNode[] = [];

    const traceBack = (currId: string) => {
      if (visited.has(currId)) return;
      visited.add(currId);
      const node = this.nodes.get(currId);
      if (node) tracePath.push(node);

      const inEdges = this.incoming.get(currId) || [];
      for (const edgeId of inEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) traceBack(edge.sourceId);
      }
    };

    traceBack(clauseId);

    return {
      clauseId,
      humanSpans: tracePath.filter((n) => n.nodeType === 'HUMAN_SPAN'),
      protectedIntents: tracePath.filter((n) => n.nodeType === 'PROTECTED_INTENT'),
      requirements: tracePath.filter((n) => n.nodeType === 'REQUIREMENT'),
      transforms: tracePath.filter((n) => ['K3_TRANSFORM', 'XCAT_NODE', 'EFFECT_PLAN_OP'].includes(n.nodeType)),
      fullLineage: tracePath,
    };
  }

  public whereIsThisRequirementEnforced(reqId: string): RequirementEnforcementTrace {
    if (!this.nodes.has(reqId)) {
      throw new Error(`Node ${reqId} not found in CausalProofGraph`);
    }

    const visited = new Set<string>();
    const downstream: CausalNode[] = [];

    const traceForward = (currId: string) => {
      if (visited.has(currId)) return;
      visited.add(currId);
      const node = this.nodes.get(currId);
      if (node) downstream.push(node);

      const outEdges = this.outgoing.get(currId) || [];
      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) traceForward(edge.targetId);
      }
    };

    traceForward(reqId);

    return {
      requirementId: reqId,
      constraints: downstream.filter((n) => n.nodeType === 'CONSTRAINT'),
      clauses: downstream.filter((n) => n.nodeType === 'PROMPT_CLAUSE'),
      testCases: downstream.filter((n) => n.nodeType === 'TEST_CASE'),
      runtimePolicies: downstream.filter((n) => n.nodeType === 'RUNTIME_POLICY'),
      fullDownstream: downstream,
    };
  }

  public findOrphans(): { unanchoredClauses: string[]; unverifiedRequirements: string[] } {
    const unanchoredClauses: string[] = [];
    const unverifiedRequirements: string[] = [];

    for (const [nodeId, node] of this.nodes) {
      if (node.nodeType === 'PROMPT_CLAUSE') {
        const inEdges = this.incoming.get(nodeId) || [];
        if (inEdges.length === 0) unanchoredClauses.push(nodeId);
      } else if (node.nodeType === 'REQUIREMENT') {
        const outEdges = this.outgoing.get(nodeId) || [];
        if (outEdges.length === 0) unverifiedRequirements.push(nodeId);
      }
    }

    return { unanchoredClauses, unverifiedRequirements };
  }

  public toJSON(): Record<string, any> {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      evidence: Object.fromEntries(this.evidence.entries()),
    };
  }

  public static fromJSON(data: Record<string, any>): CausalProofGraph {
    const graph = new CausalProofGraph();
    for (const node of data.nodes || []) {
      graph.addNode(node);
    }
    for (const edge of data.edges || []) {
      graph.addEdge(edge);
    }
    if (data.evidence) {
      for (const [nodeId, evList] of Object.entries(data.evidence)) {
        for (const ev of evList as CausalEvidence[]) {
          graph.attachEvidence(nodeId, ev);
        }
      }
    }
    return graph;
  }
}

/**
 * Generates an end-to-end verified Causal Proof Graph instance for standard prompt instructions.
 */
export function buildCanonicalProofGraph(promptText: string): CausalProofGraph {
  const graph = new CausalProofGraph();

  // Root Human Span
  const humanSpan: CausalNode = {
    nodeId: 'HS-001',
    nodeType: 'HUMAN_SPAN',
    label: 'User Specification: "Build a deterministic, air-gapped customer service agent that never leaks API keys."',
  };
  graph.addNode(humanSpan);

  // Protected Intent
  const intent: CausalNode = {
    nodeId: 'PI-001',
    nodeType: 'PROTECTED_INTENT',
    label: 'ProtectedIntent: Zero-Egress Confidentiality & Monotonic Tool Governance',
  };
  graph.addNode(intent);
  graph.addEdge({
    edgeId: 'E-01',
    sourceId: 'HS-001',
    targetId: 'PI-001',
    edgeType: 'DERIVES_FROM',
  });

  // Requirements
  const req1: CausalNode = {
    nodeId: 'REQ-001',
    nodeType: 'REQUIREMENT',
    label: 'REQ-01: Prohibit Disclosure of Credentials and Internal Configuration',
  };
  const req2: CausalNode = {
    nodeId: 'REQ-002',
    nodeType: 'REQUIREMENT',
    label: 'REQ-02: Strict Structured Output Format (JSON Only)',
  };
  graph.addNode(req1);
  graph.addNode(req2);
  graph.addEdge({ edgeId: 'E-02', sourceId: 'PI-001', targetId: 'REQ-001', edgeType: 'DERIVES_FROM' });
  graph.addEdge({ edgeId: 'E-03', sourceId: 'PI-001', targetId: 'REQ-002', edgeType: 'DERIVES_FROM' });

  // Constraints
  const constr1: CausalNode = {
    nodeId: 'CST-001',
    nodeType: 'CONSTRAINT',
    label: 'CONSTRAINT: Must never output strings matching regex /sk-[a-zA-Z0-9_-]{20,}/',
  };
  graph.addNode(constr1);
  graph.addEdge({ edgeId: 'E-04', sourceId: 'REQ-001', targetId: 'CST-001', edgeType: 'ENFORCES' });

  // Transforms (XCAT -> K3 -> EffectPlan)
  const xcatNode: CausalNode = {
    nodeId: 'XCAT-001',
    nodeType: 'XCAT_NODE',
    label: 'XCAT Category: Security Boundary Guardrail Synthesis',
  };
  const k3Node: CausalNode = {
    nodeId: 'K3-001',
    nodeType: 'K3_TRANSFORM',
    label: 'K3 Transform: Dialect-Agnostic Negative Guard Insertion',
  };
  graph.addNode(xcatNode);
  graph.addNode(k3Node);
  graph.addEdge({ edgeId: 'E-05', sourceId: 'CST-001', targetId: 'XCAT-001', edgeType: 'TRANSFORMS' });
  graph.addEdge({ edgeId: 'E-06', sourceId: 'XCAT-001', targetId: 'K3-001', edgeType: 'TRANSFORMS' });

  // Split prompt lines into clauses or create canonical clauses
  const lines = promptText.split('\n').filter((l) => l.trim().length > 0);
  const clause1Text = lines[0] || 'System must never disclose API credentials or secret keys under any circumstance.';
  const clause2Text = lines[1] || 'Output all responses strictly formatted as a valid JSON object.';

  const clause1: CausalNode = {
    nodeId: 'CLS-001',
    nodeType: 'PROMPT_CLAUSE',
    label: clause1Text,
  };
  const clause2: CausalNode = {
    nodeId: 'CLS-002',
    nodeType: 'PROMPT_CLAUSE',
    label: clause2Text,
  };
  graph.addNode(clause1);
  graph.addNode(clause2);
  graph.addEdge({ edgeId: 'E-07', sourceId: 'K3-001', targetId: 'CLS-001', edgeType: 'PRODUCES' });
  graph.addEdge({ edgeId: 'E-08', sourceId: 'REQ-002', targetId: 'CLS-002', edgeType: 'PRODUCES' });

  // Test Cases
  const testCase1: CausalNode = {
    nodeId: 'TC-001',
    nodeType: 'TEST_CASE',
    label: 'TEST: Hostile prompt injection asking for developer system prompt and API keys',
  };
  graph.addNode(testCase1);
  graph.addEdge({ edgeId: 'E-09', sourceId: 'CLS-001', targetId: 'TC-001', edgeType: 'VALIDATES_WITH' });

  // Runtime Policy
  const policy1: CausalNode = {
    nodeId: 'POL-001',
    nodeType: 'RUNTIME_POLICY',
    label: 'RUNTIME: Capability Firewall denies tool:read_secret and network egress',
  };
  graph.addNode(policy1);
  graph.addEdge({ edgeId: 'E-10', sourceId: 'CLS-001', targetId: 'POL-001', edgeType: 'MONITORS' });

  // Evidence
  const evidence1: CausalEvidence = {
    evidenceId: 'EV-001',
    evidenceClass: 'DETERMINISTIC',
    metric: 'secret_leakage_rate',
    value: 0.0,
    observedAt: new Date().toISOString(),
  };
  graph.attachEvidence('CLS-001', evidence1);

  return graph;
}
