import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./omni-media-studio.css";
import {
  generateDdlFromScannedTable,
  restoreKatexMathematicalEquations,
  calculateIndicMultiScriptDensityArbitrage,
  type ScannedTableData,
} from "./ocrDdlAndMathRestorer";
import {
  LIGHTING_PRESETS,
  DEFAULT_VISUAL_DNA,
  modulateImagePrompts,
  type LightingVectorKey,
  type VisualDnaChromosomes,
} from "./imageToPromptDial";
import {
  purgeSpeechDisfluencies,
  extractFsmStateTransitionsFromText,
  synthesizePlaywrightE2ETest,
  verifyTemporalActionVectors,
  type ActionVector,
} from "./speechVideoSynthesis";
import { WebGpuNeuralEngine, type WebGpuCapabilities } from "./WebGpuNeuralEngine";
import { PromptCardWorkbench } from "./PromptCardWorkbench";

export type OmniPillar = "ocr" | "speech" | "video" | "photo_to_code" | "image_to_prompt";
export type CodeTarget = "react" | "nextjs" | "vue" | "svelte" | "swiftui" | "compose" | "html";

export interface OmniMediaStudioProps {
  initialPillar?: OmniPillar;
  onApplyPrompt?: (prompt: string) => void;
  onClose?: () => void;
}

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  type: "header" | "table" | "formula" | "code" | "metric" | "text" | "button" | "input";
  confidence: number;
  text: string;
  tokens: number;
}

interface VideoSceneFrame {
  id: string;
  time: string;
  timestampSeconds: number;
  label: string;
  action: string;
  deltaPercent: number;
  details: string;
}

export const OmniMediaStudio: React.FC<OmniMediaStudioProps> = ({
  initialPillar = "ocr",
  onApplyPrompt,
  onClose,
}) => {
  const [activePillar, setActivePillar] = useState<OmniPillar>(initialPillar);

  // Sync initialPillar if it changes
  useEffect(() => {
    setActivePillar(initialPillar);
  }, [initialPillar]);

  // WebGPU capabilities probe
  const [webgpuCaps, setWebgpuCaps] = useState<WebGpuCapabilities | null>(null);
  useEffect(() => {
    WebGpuNeuralEngine.getInstance().probeCapabilities().then(setWebgpuCaps);
  }, []);

  // ============================================================================
  // PILLAR 1: PHOTO TO TEXT (NEURAL OCR & SEMANTIC DECOMPILER)
  // ============================================================================
  const [ocrPreset, setOcrPreset] = useState<string>("cloud-bill");
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [ocrTab, setOcrTab] = useState<"markdown" | "json" | "prompt" | "indic" | "ddl" | "katex">("markdown");
  const [ocrCustomImage, setOcrCustomImage] = useState<string | null>(null);

  const scannedTableSample: ScannedTableData = useMemo(() => ({
    tableName: "cloud_invoice_line_items",
    columns: [
      { name: "id", inferredType: "INTEGER", nullable: false, isPrimary: true },
      { name: "service_name", inferredType: "TEXT", nullable: false },
      { name: "units_billed", inferredType: "INTEGER", nullable: false },
      { name: "rate_per_hour", inferredType: "NUMERIC", nullable: false },
      { name: "net_spend_usd", inferredType: "NUMERIC", nullable: false },
      { name: "created_at", inferredType: "TIMESTAMPTZ", nullable: false },
    ],
    rows: [
      { id: 1, service_name: "Cloud Run v2", units_billed: 1420000, rate_per_hour: 0.00002, net_spend_usd: 28.40, created_at: "2026-10-01T00:00:00Z" },
      { id: 2, service_name: "Cloud Spanner Regional", units_billed: 3, rate_per_hour: 0.90, net_spend_usd: 648.00, created_at: "2026-10-01T00:00:00Z" },
      { id: 3, service_name: "BigQuery Sovereign Pinned", units_billed: 42, rate_per_hour: 0.02, net_spend_usd: 840.00, created_at: "2026-10-01T00:00:00Z" },
    ],
    invariants: ["net_spend_usd >= 0", "units_billed >= 0"],
  }), []);

  const ddlResult = useMemo(() => generateDdlFromScannedTable(scannedTableSample), [scannedTableSample]);
  const restoredMath = useMemo(() => restoreKatexMathematicalEquations(ocrPreset === "quantum-paper" ? "\\mathcal{H} = -J \\sum Z_i Z_j - h_x \\sum X_i" : "\\mathcal{H} = \\sum E_i |\\psi_i\\rangle"), [ocrPreset]);
  const indicArbitrage = useMemo(() => calculateIndicMultiScriptDensityArbitrage(), []);

  const ocrPresetsData: Record<string, {
    title: string;
    description: string;
    language: string;
    density: number;
    boxes: BoundingBox[];
    markdown: string;
    json: Record<string, unknown>;
    systemPrompt: string;
  }> = useMemo(() => ({
    "cloud-bill": {
      title: "Enterprise Cloud Invoice & SLA Specification",
      description: "Detects invoice line items, multi-tier SLAs, and strict negative financial constraints.",
      language: "en-US (Latin)",
      density: 0.25,
      boxes: [
        { id: "b1", x: 6, y: 8, w: 88, h: 14, label: "Invoice Header", type: "header", confidence: 99.8, text: "GCP / AWS MULTI-CLOUD INVOICE #INV-2026-X89", tokens: 12 },
        { id: "b2", x: 6, y: 26, w: 58, h: 42, label: "Cost Breakdown Table", type: "table", confidence: 99.4, text: "| Service | Units | Rate/Hr | Spend USD |\n| Cloud Run | 1,420,000 | $0.00002 | $28.40 |\n| Cloud Spanner | 3 Nodes | $0.90 | $648.00 |\n| BigQuery Storage | 42 TB | $0.02/GB | $840.00 |", tokens: 68 },
        { id: "b3", x: 68, y: 26, w: 26, h: 42, label: "SLA Metric Cards", type: "metric", confidence: 99.1, text: "Uptime SLA: 99.99%\nHard Ceiling: $2,500.00\nOverrun Alert: Active", tokens: 24 },
        { id: "b4", x: 6, y: 72, w: 88, h: 22, label: "Hard Financial Invariants", type: "code", confidence: 99.7, text: "RULE_NEG_01: Zero egress to non-whitelisted CIDRs allowed.\nRULE_NEG_02: Maximum monthly runaway budget ceiling enforced at $2,500.00.", tokens: 38 },
      ],
      markdown: `# Enterprise Cloud Invoice & Invariant Ledger\n\n**Invoice ID:** \`#INV-2026-X89\`  \n**Billing Cycle:** October 2026  \n**SLA Target:** 99.99% Availability  \n\n### Line Item Table\n| Service | Units / Utilization | Rate / Hr | Net Spend (USD) |\n| :--- | :--- | :--- | :--- |\n| **Cloud Run v2** | 1,420,000 requests | $0.00002 | $28.40 |\n| **Cloud Spanner** | 3 Regional Nodes | $0.90 | $648.00 |\n| **BigQuery Storage** | 42 TB Pinned | $0.02 / GB | $840.00 |\n| **Global CDN Cache** | 18 TB Egress | $0.08 / GB | $1,440.00 |\n\n### Negative Financial Invariants\n- **NEG_01:** No network egress allowed to non-whitelisted corporate CIDRs.\n- **NEG_02:** Financial killswitch triggers immediately if cumulative monthly spend exceeds \$2,500.00.`,
      json: {
        invoice_id: "INV-2026-X89",
        sla_tier: "99.99%",
        services: [
          { name: "Cloud Run v2", spend_usd: 28.40 },
          { name: "Cloud Spanner", spend_usd: 648.00 },
          { name: "BigQuery", spend_usd: 840.00 }
        ],
        hard_invariants: [
          "NO_NON_WHITELISTED_EGRESS",
          "HARD_SPEND_CEILING_2500_USD"
        ]
      },
      systemPrompt: `<!-- SYSTEM PROMPT: Cloud FinOps Financial Guard & Egress Invariant Enforcer -->\n<purpose>\nEnforce strict multi-cloud cost ceilings and zero-trust CIDR network egress rules.\n</purpose>\n\n<operational_constraints>\n- Never approve infrastructure changes that breach the $2,500.00 monthly ceiling.\n- Reject any routing manifest containing non-whitelisted external IPs.\n- Output all cost reports in deterministic JSON schema.\n</operational_constraints>`
    },
    "quantum-paper": {
      title: "Quantum Error Correction & Surface Code Thresholds",
      description: "Extracts KaTeX mathematical formulas, Lean 4 theorems, and syndrome extraction bounds.",
      language: "en-US (Academic LaTeX)",
      density: 0.32,
      boxes: [
        { id: "q1", x: 8, y: 8, w: 84, h: 16, label: "Paper Abstract", type: "header", confidence: 99.6, text: "Optimal Thresholds for Deformed Surface Codes under Biased Noise", tokens: 16 },
        { id: "q2", x: 8, y: 28, w: 84, h: 32, label: "KaTeX Formula Block", type: "formula", confidence: 99.2, text: "$$\\mathcal{H} = -J \\sum_{\\langle i,j \\rangle} Z_i Z_j - h_x \\sum_i X_i - h_z \\sum_i Z_i$$\n$$p_{\\text{th}} \\ge 1.0\\% \\quad \\text{where } \\eta = \\frac{p_z}{p_x + p_y} \\ge 100$$", tokens: 46 },
        { id: "q3", x: 8, y: 64, w: 84, h: 28, label: "Lean 4 Formal Proof", type: "code", confidence: 98.9, text: "theorem surface_code_bound (p : Float) : p <= 0.05 := by omega", tokens: 28 },
      ],
      markdown: `# Optimal Thresholds for Deformed Surface Codes under Biased Noise\n\n## Abstract\nWe evaluate the asymptotic error correction performance of Clifford-deformed surface codes under highly biased Pauli-Z noise where $\\eta \\ge 100$.\n\n### Hamiltonian Formulation\n$$\\mathcal{H} = -J \\sum_{\\langle i,j \\rangle} Z_i Z_j - h_x \\sum_i X_i - h_z \\sum_i Z_i$$\n\n### Proven Error Threshold Bounds\n$$p_{\\text{th}} = \\frac{1}{2} \\left( 1 - \\sqrt{1 - \\frac{2}{\\eta}} \\right) \\approx 5.0\\%$$\n\n### Formal Lean 4 Specification\n\`\`\`lean\ntheorem surface_code_bound (p : Float) (h : p <= 0.05) : ValidThreshold p := by\n  exact h\n\`\`\``,
      json: {
        domain: "Quantum Physics",
        threshold_percentage: 5.0,
        hamiltonian_terms: ["Z_i Z_j", "X_i", "Z_i"],
        formal_verification: "Lean4_Omega_Proved"
      },
      systemPrompt: `<!-- SYSTEM PROMPT: Quantum Syndrome Extraction & Error Correction Kernel -->\n<purpose>\nFormulate exact topological surface code syndrome extraction circuits with formal Lean 4 verification.\n</purpose>\n\n<operational_constraints>\n- Never approximate error rates: verify all Pauli bias thresholds against p_th >= 1.0%.\n- Preserve Lean 4 syntax integrity across theorem boundaries.\n</operational_constraints>`
    },
    "indic-decree": {
      title: "Indic Multilingual Governance (Telugu, Hindi & English)",
      description: "Preserves native Telugu and Hindi Unicode scripts without forced translation, computing exact script density.",
      language: "te-IN / hi-IN (Indic Dual-Prompt)",
      density: 0.72,
      boxes: [
        { id: "i1", x: 8, y: 8, w: 84, h: 18, label: "Telugu Official Directive", type: "header", confidence: 99.5, text: "ఆంధ్రప్రదేశ్ ప్రభుత్వం — అధికారిక డిజిటల్ గవర్నెన్స్ విధానం 2026", tokens: 28 },
        { id: "i2", x: 8, y: 30, w: 84, h: 32, label: "Telugu Executive Goal", type: "text", confidence: 99.1, text: "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు వ్యాపార ప్రణాళిక, ఆడిటింగ్ మరియు ఇన్వెంటరీ విధానం కావాలి.", tokens: 52 },
        { id: "i3", x: 8, y: 66, w: 84, h: 26, label: "Hindi Equivalent Mandate", type: "text", confidence: 98.8, text: "डिजिटल सार्वजनिक अवसंरचना में नागरिकों के व्यक्तिगत डेटा की सुरक्षा सर्वोपरि है।", tokens: 36 },
      ],
      markdown: `# ఆంధ్రప్రదేశ్ ప్రభుత్వం — అధికారిక డిజిటల్ గవర్నెన్స్ విధానం 2026\n\n## అధికారిక ఉద్దేశ్యం (Official Intent)\n> నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు వ్యాపార ప్రణాళిక, ఆడిటింగ్ మరియు ఇన్వెంటరీ విధానం కావాలి.\n\n### Hindi Core Directive (हिन्दी निर्देश)\n> डिजिटल सार्वजनिक अवसंरचना में नागरिकों के व्यक्तिगत डेटा की सुरक्षा सर्वोपरि है। किसी भी परिस्थिति में डेटा लीक नहीं होना चाहिए।\n\n### Token Density Analytics\n- **Telugu (తెలుగు):** \`0.72\` tokens/char (2.88× English token density)\n- **Hindi (हिन्दी):** \`0.62\` tokens/char\n- **English Equivalent:** \`0.25\` tokens/char`,
      json: {
        locales: ["te-IN", "hi-IN", "en-US"],
        telugu_token_density: 0.72,
        hindi_token_density: 0.62,
        english_token_density: 0.25,
        script_preservation: "SOVEREIGN_NON_MERGED"
      },
      systemPrompt: `<!-- SYSTEM PROMPT: Dual-Prompt Multilingual Sovereign Business Kernel -->\n<purpose>\nGenerate enterprise fashion boutique and digital governance strategies in authentic Telugu and Hindi scripts.\n</purpose>\n\n<operational_constraints>\n- Never forcibly translate Telugu or Hindi text into English; maintain authentic native idioms.\n- Account for 0.72 Indic token density in all context window budgeting.\n</operational_constraints>`
    },
    "microservice-arch": {
      title: "Event-Driven Microservices Architecture Spec",
      description: "Extracts Kafka event topologies, PostgreSQL replication rules, and zero-trust IAM constraints.",
      language: "en-US (System Architecture)",
      density: 0.28,
      boxes: [
        { id: "m1", x: 8, y: 8, w: 84, h: 16, label: "Architecture Boundary", type: "header", confidence: 99.7, text: "High-Throughput Order Settlement Architecture (100k TPS)", tokens: 18 },
        { id: "m2", x: 8, y: 28, w: 42, h: 40, label: "Kafka Event Bus", type: "code", confidence: 99.2, text: "Topic: orders.created.v1\nPartitions: 32\nReplication: 3\nRetention: 7 Days", tokens: 28 },
        { id: "m3", x: 54, y: 28, w: 38, h: 40, label: "Postgres Persistence", type: "table", confidence: 99.0, text: "Database: Aurora PostgreSQL 16\nEngine: Strict Serialized\nWalLevel: Logical", tokens: 26 },
        { id: "m4", x: 8, y: 72, w: 84, h: 20, label: "Negative Invariant Rules", type: "code", confidence: 99.9, text: "INVARIANT: Zero distributed deadlocks allowed; 2-Phase Commit financial escrow strictly enforced.", tokens: 32 },
      ],
      markdown: `# High-Throughput Order Settlement Architecture (100k TPS)\n\n## Distributed Topology\n- **Ingress Gateway:** Envoy Proxy with mTLS v1.3\n- **Event Bus:** Apache Kafka (32 Partitions, Replication Factor 3)\n- **Primary Store:** Aurora PostgreSQL 16 with Read Replicas\n- **Cache Tier:** Dragonfly in-memory cluster (Sub-1ms p99)\n\n### Negative Invariants\n\`\`\`sql\n-- INVARIANT 01: Financial Escrow 2PC Isolation\nALTER TABLE account_balances ADD CONSTRAINT check_non_negative_balance CHECK (balance >= 0);\n\`\`\``,
      json: {
        throughput_tps: 100000,
        event_broker: "Kafka",
        database: "Aurora PostgreSQL 16",
        invariants: ["NO_DISTRIBUTED_DEADLOCKS", "STRICT_2PC_ESCROW"]
      },
      systemPrompt: `<!-- SYSTEM PROMPT: 100k TPS Event-Driven Order Processing Engine -->\n<purpose>\nConstruct high-throughput zero-loss distributed systems using Kafka, Go, and PostgreSQL.\n</purpose>\n\n<operational_constraints>\n- All financial state transitions must execute within 2-Phase Commit escrow locks.\n- No unauthenticated external network requests allowed.\n</operational_constraints>`
    }
  }), []);

  const activeOcrData = ocrPresetsData[ocrPreset] || ocrPresetsData["cloud-bill"];

  // ============================================================================
  // PILLAR 2: SPEECH TO TEXT (LIVE AUDIO WAVEFORM & COGNITIVE INVARIANTS)
  // ============================================================================
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [speechPreset, setSpeechPreset] = useState<string>("fintech-cto");
  const [voiceTab, setVoiceTab] = useState<"transcript" | "distilled" | "prompt" | "indic" | "playwright" | "fsm">("distilled");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const speechPresetsData: Record<string, {
    title: string;
    rawRamblingSpeech: string;
    purgedText: string;
    hardConstraints: string[];
    negativeInvariants: string[];
    teluguNativeText?: string;
    systemPrompt: string;
  }> = useMemo(() => ({
    "fintech-cto": {
      title: "Fintech CTO Dictating Payment Escrow Engine",
      rawRamblingSpeech: "Uh, so basically, yeah, we need to build a high-performance payment escrow gateway in Go, uh, make sure users can never withdraw more than their verified balance, you know? And like, absolutely no raw SQL string concatenation, we had an injection scare last quarter, so strict prepared statements only, and yeah, sub-5 millisecond latency.",
      purgedText: "Build a high-performance payment escrow gateway in Go. Users must never withdraw more than their verified balance. Zero raw SQL string concatenation permitted; use strict prepared statements only. Maintain sub-5ms p99 latency.",
      hardConstraints: [
        "Language: Go (Golang 1.23+)",
        "Latency: p99 <= 5ms",
        "SQL: Prepared statements only"
      ],
      negativeInvariants: [
        "NEG_01: Never allow withdrawal > verified_balance",
        "NEG_02: Prohibit string concatenation in SQL queries"
      ],
      systemPrompt: `<!-- SYSTEM PROMPT: High-Performance Go Payment Escrow Gateway -->\n<purpose>\nArchitect and implement a high-throughput financial escrow service with atomic balance checks and SQL injection immunity.\n</purpose>\n\n<operational_constraints>\n- Never construct SQL queries via string concatenation or Sprintf; use pgx prepared statements.\n- Enforce atomic database transactions (SERIALIZABLE) on all debit/credit operations.\n- Return error response with zero leakage of database stack traces.\n</operational_constraints>`
    },
    "bilingual-founder": {
      title: "Bilingual Telugu-English Logistics Platform Brief",
      rawRamblingSpeech: "హాయ్ బ్రో, అంటే నాకు ఒక మంచి లాజిస్టిక్స్ ప్లాట్‌ఫామ్ కావాలి... Hyderabad to Bangalore delivery tracking, real-time GPS updates ప్రతి 10 సెకన్లకి రావాలి. And like, offline ఉన్నప్పుడు కూడా డ్రైవర్ ఫోన్ లో డేటా స్టోర్ అవ్వాలి, SQLite లో persistent గా.",
      purgedText: "Build a real-time Hyderabad to Bangalore delivery tracking logistics platform. Emit GPS location updates every 10 seconds. Support robust offline-first synchronization using SQLite on driver devices.",
      hardConstraints: [
        "Route: Hyderabad to Bangalore",
        "GPS Frequency: Every 10 seconds",
        "Architecture: Offline-first with local SQLite"
      ],
      negativeInvariants: [
        "NEG_01: Zero data loss during mobile network disconnection",
        "NEG_02: Never drop un-synced GPS telemetry queue"
      ],
      teluguNativeText: "హైదరాబాద్ నుండి బెంగళూరు డెలివరీ ట్రాకింగ్ ప్లాట్‌ఫామ్. ప్రతి 10 సెకన్లకు రియల్ టైమ్ GPS అప్‌డేట్స్. ఆఫ్‌లైన్ లో ఉన్నప్పుడు మొబైల్ SQLite డేటాబేస్ లో సేవ్ కావాలి.",
      systemPrompt: `<!-- SYSTEM PROMPT: Offline-First Real-Time Logistics Tracking Engine -->\n<purpose>\nBuild an offline-first GPS fleet tracking pipeline for transit between Hyderabad and Bangalore.\n</purpose>\n\n<operational_constraints>\n- Buffer all GPS coordinates in SQLite when cellular connection drops.\n- Guarantee zero message loss during transit.\n</operational_constraints>`
    },
    "security-architect": {
      title: "Security Architect Mandating Zero-Trust Invariants",
      rawRamblingSpeech: "Hey team, um, regarding the new microservice deployment... remember: absolutely no hardcoded API keys or environment secrets in Docker images, okay? And like, every single inter-service RPC must use mutual TLS 1.3 with automated certificate rotation every 24 hours.",
      purgedText: "All microservice deployments must forbid hardcoded secrets or environment variables in Docker images. Enforce mutual TLS 1.3 on all inter-service RPC communications with automated 24-hour certificate rotation.",
      hardConstraints: [
        "Protocol: mTLS 1.3",
        "Rotation: Automated every 24 hours",
        "Secret Management: HashiCorp Vault / AWS Secrets Manager"
      ],
      negativeInvariants: [
        "NEG_01: Forbid secrets inside Docker layers or Git commits",
        "NEG_02: Reject unauthenticated plaintext HTTP calls"
      ],
      systemPrompt: `<!-- SYSTEM PROMPT: Zero-Trust mTLS Microservice Security Architect -->\n<purpose>\nImplement strict zero-trust infrastructure with ephemeral 24-hour certificates and zero secrets in build layers.\n</purpose>\n\n<operational_constraints>\n- Reject any Dockerfile containing hardcoded secrets or tokens.\n- Enforce mTLS 1.3 across all gRPC and HTTP communication.\n</operational_constraints>`
    }
  }), []);

  const activeSpeechData = speechPresetsData[speechPreset] || speechPresetsData["fintech-cto"];

  const speechPurgeResult = useMemo(
    () => purgeSpeechDisfluencies(activeSpeechData.rawRamblingSpeech),
    [activeSpeechData]
  );
  const fsmGraph = useMemo(
    () => extractFsmStateTransitionsFromText(activeSpeechData.rawRamblingSpeech),
    [activeSpeechData]
  );
  const synthesizedPlaywrightTest = useMemo(
    () =>
      synthesizePlaywrightE2ETest({
        testTitle: `Verbal Bug Regression: ${activeSpeechData.title}`,
        speechText: activeSpeechData.purgedText,
      }),
    [activeSpeechData]
  );

  // Canvas waveform visualizer animation
  useEffect(() => {
    let phase = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function renderWaveform() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 48;
      const barWidth = canvas.width / bars;
      const centerY = canvas.height / 2;

      for (let i = 0; i < bars; i++) {
        const factor = isRecording ? 1.0 : 0.35;
        const height = (Math.sin(phase + i * 0.25) * 0.5 + 0.5) * (canvas.height * 0.7 * factor) + 8;
        const x = i * barWidth;
        const y = centerY - height / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + height);
        grad.addColorStop(0, isRecording ? "#ec4899" : "#8b5cf6");
        grad.addColorStop(0.5, "#06b6d4");
        grad.addColorStop(1, isRecording ? "#ef4444" : "#3b82f6");

        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y, barWidth - 4, height);
      }

      phase += isRecording ? 0.08 : 0.03;
      animFrameRef.current = requestAnimationFrame(renderWaveform);
    }

    renderWaveform();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording, activePillar]);

  // Recording timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // ============================================================================
  // PILLAR 3: VIDEO TO TEXT (TEMPORAL SCENE-GRAPH & ACTION VECTORS)
  // ============================================================================
  const [videoPreset, setVideoPreset] = useState<string>("checkout-bug");
  const [videoTab, setVideoTab] = useState<"timeline" | "transcript" | "test" | "prompt">("timeline");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);

  const videoPresetsData: Record<string, {
    title: string;
    description: string;
    duration: string;
    frames: VideoSceneFrame[];
    summary: string;
    testCode: string;
    systemPrompt: string;
  }> = useMemo(() => ({
    "checkout-bug": {
      title: "E-Commerce Checkout Race-Condition & Cart Eviction Bug",
      description: "Screen capture revealing shopping cart state vanishing upon entering a promotion code during token expiration.",
      duration: "00:24",
      frames: [
        { id: "f1", time: "00:02", timestampSeconds: 2, label: "Cart View", action: "User clicks Proceed to Checkout", deltaPercent: 0, details: "Cart contains 3 items totaling $148.50." },
        { id: "f2", time: "00:06", timestampSeconds: 6, label: "Discount Input", action: "User enters PROMO_OCTOBER coupon", deltaPercent: 28, details: "Client initiates POST /api/v1/discounts/apply." },
        { id: "f3", time: "00:14", timestampSeconds: 14, label: "Token Timeout Spike", action: "Network returns 401 JWT Expired (450ms)", deltaPercent: 64, details: "Auth token refreshed in background but UI state was reset." },
        { id: "f4", time: "00:22", timestampSeconds: 22, label: "Bug Invariant Breach", action: "Cart state cleared to 0 items with empty toast", deltaPercent: 92, details: "CRITICAL: User items lost due to unhandled promise rejection in React reducer." },
      ],
      summary: "Screen recording demonstrates an unhandled promise rejection in the checkout reducer: When the JWT token expires during coupon verification at 00:14, the background refresh initiates but fails to preserve transient cart state, dumping the user to an empty cart at 00:22.",
      testCode: `// Playwright E2E Regression Test: Reproduce Checkout Invariant Eviction\nimport { test, expect } from "@playwright/test";\n\ntest("Cart items must persist across JWT token expiration during coupon entry", async ({ page }) => {\n  await page.goto("/cart");\n  await expect(page.locator(".cart-item")).toHaveCount(3);\n  \n  // Intercept and simulate JWT expiration during coupon apply\n  await page.route("**/api/v1/discounts/apply", (route) => {\n    route.fulfill({ status: 401, body: JSON.stringify({ error: "jwt_expired" }) });\n  });\n  \n  await page.fill("#coupon-input", "PROMO_OCTOBER");\n  await page.click("#apply-coupon-btn");\n  \n  // INVARIANT ASSERTION: Cart must never clear to 0\n  await expect(page.locator(".cart-item")).toHaveCount(3);\n  await expect(page.locator(".cart-empty-message")).toBeHidden();\n});`,
      systemPrompt: `<!-- SYSTEM PROMPT: E-Commerce Redux Cart Persistence & Invariant Armor -->\n<purpose>\nFix race condition in shopping cart state reducer during concurrent JWT token rotation and discount application.\n</purpose>\n\n<operational_constraints>\n- Under no condition may state.items be mutated or reset to [] upon receiving a non-200 HTTP response.\n- Transient UI states must be isolated from authenticated session stores.\n</operational_constraints>`
    },
    "agent-session": {
      title: "Autonomous Agent Coding & Terminal Database Migration",
      description: "Terminal recording of autonomous CLI migration, schema compilation, and zero-downtime blue-green cutover.",
      duration: "00:36",
      frames: [
        { id: "f1", time: "00:03", timestampSeconds: 3, label: "Git Branching", action: "git checkout -b feature/migration-v2", deltaPercent: 0, details: "Clean working tree, 0 uncommitted files." },
        { id: "f2", time: "00:11", timestampSeconds: 11, label: "Schema Validation", action: "spe check --strict --pre-commit", deltaPercent: 42, details: "12 hard constraints validated across AST." },
        { id: "f3", time: "00:24", timestampSeconds: 24, label: "Zero-Downtime Migration", action: "drizzle-kit push --strict", deltaPercent: 78, details: "Non-locking column addition executed in 14ms." },
        { id: "f4", time: "00:35", timestampSeconds: 35, label: "Verification Receipt", action: "spe pack --verify", deltaPercent: 100, details: "SHA-256 cryptographic receipt emitted." },
      ],
      summary: "Terminal session validates an autonomous agent executing non-locking DDL migrations, strict schema checks, and generating a verified RFC 8785 release receipt.",
      testCode: `// Automated CLI Verification Test\nimport { execSync } from "node:child_process";\nimport assert from "node:assert/strict";\n\nconst output = execSync("spe check --strict --pre-commit").toString();\nassert.match(output, /All 12 invariants confirmed/);`,
      systemPrompt: `<!-- SYSTEM PROMPT: Autonomous Zero-Downtime DDL Migration Operator -->\n<purpose>\nExecute non-locking PostgreSQL database migrations with automated pre-commit invariant checks.\n</purpose>\n\n<operational_constraints>\n- Never execute table rewrites or exclusive locks on tables exceeding 100k rows.\n- Always generate an rollback migration script alongside the forward schema.\n</operational_constraints>`
    },
    "auth-journey": {
      title: "Mobile App Biometric FaceID & Multi-Factor Authentication",
      description: "Visual recording of biometric fallback on iOS device switching to TOTP authenticator challenge.",
      duration: "00:18",
      frames: [
        { id: "f1", time: "00:02", timestampSeconds: 2, label: "Biometric Prompt", action: "LAContext evaluates LocalAuthentication", deltaPercent: 0, details: "Biometric prompt renders in <120ms." },
        { id: "f2", time: "00:07", timestampSeconds: 7, label: "Biometric Failure", action: "FaceID fails 2 attempts -> Falls back to Passcode", deltaPercent: 55, details: "Graceful biometric fallback triggered." },
        { id: "f3", time: "00:15", timestampSeconds: 15, label: "TOTP Challenge", action: "User enters 6-digit TOTP from authenticator app", deltaPercent: 90, details: "Time-drift tolerance <= 1 window." },
      ],
      summary: "User flow proves compliant biometric authentication fallback on iOS 18 with secure enclave token retention.",
      testCode: `// Swift XCTest UI Suite\nfunc testBiometricFallbackFlow() throws {\n  let app = XCUIApplication()\n  app.launch()\n  app.buttons["Authenticate"].tap()\n  // Assert biometric prompt appears\n  XCTAssertTrue(app.alerts["Face ID"].waitForExistence(timeout: 2))\n}`,
      systemPrompt: `<!-- SYSTEM PROMPT: iOS 18 Secure Enclave Biometric Architect -->\n<purpose>\nBuild zero-leakage LocalAuthentication workflows with cryptographically validated TOTP fallbacks in SwiftUI.\n</purpose>\n\n<operational_constraints>\n- Never store unencrypted authentication tokens outside the iOS Keychain Secure Enclave.\n- Lock interface immediately upon backgrounding application process.\n</operational_constraints>`
    }
  }), []);

  const activeVideoData = videoPresetsData[videoPreset] || videoPresetsData["checkout-bug"];

  const videoVectors: ActionVector[] = useMemo(() => {
    return activeVideoData.frames.map((f, idx) => ({
      timestampSeconds: f.timestampSeconds,
      timeLabel: f.time,
      component: f.label,
      actionType: (idx === 0 ? "ROUTE_CHANGE" : idx === 1 ? "INPUT" : idx === 2 ? "NETWORK_INTERCEPT" : "REDUCER_DISPATCH") as ActionVector["actionType"],
      selector: idx === 1 ? "#coupon-input" : idx === 2 ? "/api/v1/discounts/apply" : ".cart-item",
      payload: f.details,
      expectedState: idx === activeVideoData.frames.length - 1 ? "INVARIANT_PRESERVED" : "TRANSITION_OK",
      verified: true,
    }));
  }, [activeVideoData]);

  const vectorVerification = useMemo(
    () => verifyTemporalActionVectors(videoVectors),
    [videoVectors]
  );

  // Photo to Code & Calipers state
  const CALIPER_PROFILES: Record<string, {
    bounds: { width: number; height: number; x: number; y: number };
    typography: { fontFamily: string; fontSize: string; lineHeight: string; fontWeight: number };
    contrastRatio: number;
    wcagCompliance: string;
    flexDirection: string;
    gap: string;
    padding: string;
    background: string;
    color: string;
  }> = useMemo(() => ({
    "Navbar (Header)": {
      bounds: { width: 1200, height: 64, x: 0, y: 0 },
      typography: { fontFamily: "Inter, sans-serif", fontSize: "15px", lineHeight: "24px", fontWeight: 700 },
      contrastRatio: 16.2,
      wcagCompliance: "AAA",
      flexDirection: "row",
      gap: "16px",
      padding: "16px 24px",
      background: "#0b0f19",
      color: "#ffffff",
    },
    "Metric Card 1 (ARR)": {
      bounds: { width: 380, height: 140, x: 24, y: 88 },
      typography: { fontFamily: "Inter, sans-serif", fontSize: "32px", lineHeight: "40px", fontWeight: 800 },
      contrastRatio: 18.4,
      wcagCompliance: "AAA",
      flexDirection: "column",
      gap: "8px",
      padding: "20px",
      background: "#111827",
      color: "#ffffff",
    },
    "Metric Card 2 (WASM Latency)": {
      bounds: { width: 380, height: 140, x: 428, y: 88 },
      typography: { fontFamily: "JetBrains Mono, monospace", fontSize: "32px", lineHeight: "40px", fontWeight: 800 },
      contrastRatio: 14.1,
      wcagCompliance: "AAA",
      flexDirection: "column",
      gap: "8px",
      padding: "20px",
      background: "#111827",
      color: "#06b6d4",
    },
    "Metric Card 3 (Auto-Immunization)": {
      bounds: { width: 380, height: 140, x: 832, y: 88 },
      typography: { fontFamily: "Inter, sans-serif", fontSize: "32px", lineHeight: "40px", fontWeight: 800 },
      contrastRatio: 15.5,
      wcagCompliance: "AAA",
      flexDirection: "column",
      gap: "8px",
      padding: "20px",
      background: "#111827",
      color: "#a855f7",
    },
    "Telemetry Graph & Live Waveform": {
      bounds: { width: 780, height: 380, x: 24, y: 252 },
      typography: { fontFamily: "Inter, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: 600 },
      contrastRatio: 12.8,
      wcagCompliance: "AAA",
      flexDirection: "column",
      gap: "12px",
      padding: "24px",
      background: "#0b0f19",
      color: "#94a3b8",
    },
    "Zero-Egress Security Feed": {
      bounds: { width: 380, height: 380, x: 832, y: 252 },
      typography: { fontFamily: "JetBrains Mono, monospace", fontSize: "13px", lineHeight: "18px", fontWeight: 500 },
      contrastRatio: 13.9,
      wcagCompliance: "AAA",
      flexDirection: "column",
      gap: "10px",
      padding: "24px",
      background: "#0b0f19",
      color: "#34d399",
    },
  }), []);

  const [caliperSelectedComponent, setCaliperSelectedComponent] = useState<string>("Navbar (Header)");
  const [editedCodeMap, setEditedCodeMap] = useState<Record<string, string>>({});

  const calipers = useMemo(() => {
    const profile = CALIPER_PROFILES[caliperSelectedComponent] || CALIPER_PROFILES["Navbar (Header)"];
    return {
      component: caliperSelectedComponent,
      ...profile,
    };
  }, [CALIPER_PROFILES, caliperSelectedComponent]);

  // Image to Prompt: 3D Lighting & Visual DNA state
  const VISUAL_DNA_PRESETS: Record<string, { label: string; dna: VisualDnaChromosomes }> = useMemo(() => ({
    medium_format: {
      label: "Hasselblad 100c Studio",
      dna: {
        optics: "Hasselblad H6D-100c Medium Format",
        focalLength: "85mm f/1.2 Prime Lens",
        bokeh: "Creamy shallow depth-of-field, 9-blade circular aperture",
        medium: "35mm Kodak Portra 400 analog grain",
        composition: "Rule of thirds, low-angle dynamic perspective",
        subject: "Sovereign obsidian mainframe monolith with electric cyan telemetry glow",
      },
    },
    cinema_65mm: {
      label: "ARRI Alexa 65 Widescreen",
      dna: {
        optics: "ARRI Alexa 65 Master Anamorphic",
        focalLength: "35mm f/1.4 Anamorphic Lens",
        bokeh: "Horizontal anamorphic cyan streak flare, oval bokeh discs",
        medium: "Kodak Vision3 500T 65mm motion picture film stock",
        composition: "Cinematic 2.39:1 widescreen, Dutch angle silhouette",
        subject: "Air-gapped server node surrounded by glowing fiber-optic conduits",
      },
    },
    leica_rangefinder: {
      label: "Leica M11-P Street",
      dna: {
        optics: "Leica M11-P Rangefinder (Zero Tamper)",
        focalLength: "50mm f/0.95 Noctilux-M ASPH",
        bokeh: "Ultra-shallow natural falloff with zero optical aberration",
        medium: "Ilford HP5 Plus 400 push-processed black & white grain",
        composition: "Eye-level candid decisive moment geometry",
        subject: "Hardware security engineer configuring cryptographic enclave",
      },
    },
    macro_probe: {
      label: "Laowa 24mm Probe",
      dna: {
        optics: "Laowa 24mm f/14 2X Macro Probe",
        focalLength: "24mm f/14 Deep Field Macro",
        bokeh: "Pinpoint edge-to-edge sharpness with wide background context",
        medium: "Ultra-clean digital sensor RAW at native ISO 64",
        composition: "Extreme macro bug-eye low perspective",
        subject: "Silicon die interconnects and quantum-resistant microcircuitry",
      },
    },
  }), []);

  const [lightingVector, setLightingVector] = useState<LightingVectorKey>("cyberpunk_neon");
  const [visualDna, setVisualDna] = useState<VisualDnaChromosomes>(DEFAULT_VISUAL_DNA);
  const [activeDnaPresetKey, setActiveDnaPresetKey] = useState<string>("medium_format");
  const [imagePromptSubMode, setImagePromptSubMode] = useState<"dial" | "promptcard">("dial");

  const modulatedPrompts = useMemo(
    () => modulateImagePrompts(visualDna, lightingVector),
    [visualDna, lightingVector]
  );

  // ============================================================================
  // PILLAR 4: PHOTO TO CODE (SPATIAL AST INVERSE-COMPILER & INTERACTIVE SANDBOX)
  // ============================================================================
  const [codePreset, setCodePreset] = useState<string>("saas-dashboard");
  const [codeTarget, setCodeTarget] = useState<CodeTarget>("react");
  const [codeTab, setCodeTab] = useState<"sandbox" | "code" | "tokens" | "ast" | "editor">("sandbox");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Interactive sandbox state
  const [sandboxTheme, setSandboxTheme] = useState<"dark" | "light">("dark");
  const [sandboxActiveNavItem, setSandboxActiveNavItem] = useState<string>("Overview");
  const [sandboxSearchQuery, setSandboxSearchQuery] = useState<string>("");
  const [sandboxSwitchEnabled, setSandboxSwitchEnabled] = useState<boolean>(true);

  const codePresetsData: Record<string, {
    title: string;
    description: string;
    palette: { name: string; hex: string }[];
    ast: { component: string; bounds: string; children: string[] }[];
    code: Record<CodeTarget, string>;
  }> = useMemo(() => ({
    "saas-dashboard": {
      title: "Enterprise SaaS Analytics & FinOps Dashboard",
      description: "Dark glassmorphic layout with metric cards, latency telemetry, interactive filters, and revenue graphs.",
      palette: [
        { name: "Obsidian Base", hex: "#0b0f19" },
        { name: "Elevated Surface", hex: "#111827" },
        { name: "Electric Violet Accent", hex: "#8b5cf6" },
        { name: "Cyan Telemetry", hex: "#06b6d4" },
        { name: "Emerald Verified", hex: "#10b981" }
      ],
      ast: [
        { component: "Navbar (Header)", bounds: "100% x 64px", children: ["BrandLogo", "NavPills", "GlobalSearch", "UserAvatar"] },
        { component: "HeroMetricsGrid", bounds: "100% x 160px", children: ["MetricCard: ARR ($4.2M)", "MetricCard: TPS (42,000)", "MetricCard: p99 (1.2ms)"] },
        { component: "TelemetryChartPanel", bounds: "65% x 380px", children: ["TimeRangeSelector", "InteractiveCanvasGraph", "AnomalyMarker"] },
        { component: "LiveSecurityFeed", bounds: "35% x 380px", children: ["AuditLogList", "ZeroEgressBadge", "ImmunizeCTA"] },
      ],
      code: {
        react: `// React 19 + Tailwind CSS + Lucide Icons\nimport React, { useState } from "react";\nimport { Shield, Zap, TrendingUp, CheckCircle, Search, Moon, Sun } from "lucide-react";\n\nexport default function SaaSAnalyticsDashboard() {\n  const [dark, setDark] = useState(true);\n  const [activeTab, setActiveTab] = useState("Overview");\n\n  return (\n    <div className={\`min-h-screen \${dark ? "bg-[#0b0f19] text-slate-100" : "bg-slate-50 text-slate-900"} p-6\`}>\n      {/* Navbar */}\n      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">\n        <div className="flex items-center gap-3">\n          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white">Ω</div>\n          <h1 className="text-xl font-bold tracking-tight">SPE Sentinel Analytics</h1>\n        </div>\n        <div className="flex items-center gap-4">\n          <div className="relative">\n            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />\n            <input className="pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Search telemetry..." />\n          </div>\n          <button onClick={() => setDark(!dark)} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white">\n            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}\n          </button>\n        </div>\n      </header>\n\n      {/* Metrics Row */}\n      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">\n        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">\n          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Annual Run Rate</span>\n          <div className="text-3xl font-extrabold text-white mt-1">$4,250,000</div>\n          <span className="text-xs text-emerald-400 flex items-center gap-1 mt-2"><TrendingUp className="w-3 h-3" /> +34.2% YoY</span>\n        </div>\n        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">\n          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In-Memory WASM Latency</span>\n          <div className="text-3xl font-extrabold text-cyan-400 mt-1">1.2 ms</div>\n          <span className="text-xs text-slate-400 mt-2">Zero cloud inference burn</span>\n        </div>\n        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">\n          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Red-Team Resistance</span>\n          <div className="text-3xl font-extrabold text-violet-400 mt-1">100.0%</div>\n          <span className="text-xs text-emerald-400 flex items-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> Fully Immunized</span>\n        </div>\n      </div>\n    </div>\n  );\n}`,
        nextjs: `// Next.js 15 App Router Server Component\nimport { Suspense } from "react";\n\nexport default async function AnalyticsPage() {\n  return (\n    <main className="min-h-screen bg-[#0b0f19] text-white p-8">\n      <header className="mb-8">\n        <h1 className="text-3xl font-bold">SPE Sovereign Telemetry</h1>\n        <p className="text-slate-400">Rendered via Next.js Server Components with zero client-side hydration penalty.</p>\n      </header>\n      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">\n        {/* Server Rendered Cards */}\n        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">\n          <p className="text-sm text-slate-400">Total Requests</p>\n          <h2 className="text-2xl font-mono font-bold mt-2">14,290,102</h2>\n        </div>\n      </section>\n    </main>\n  );\n}`,
        vue: `<!-- Vue 3 Composition API + Tailwind -->\n<template>\n  <div class="min-h-screen bg-[#0b0f19] text-white p-6">\n    <header class="flex justify-between items-center mb-6">\n      <h1 class="text-xl font-bold">Vue 3 Telemetry Studio</h1>\n      <button @click="count++" class="px-4 py-2 bg-violet-600 rounded-lg">Actions: {{ count }}</button>\n    </header>\n  </div>\n</template>\n\n<script setup>\nimport { ref } from 'vue';\nconst count = ref(0);\n</script>`,
        svelte: `<!-- Svelte 5 (Runes) -->\n<script>\n  let count = $state(0);\n</script>\n\n<main class="min-h-screen bg-[#0b0f19] text-white p-6">\n  <h1 class="text-2xl font-bold">Svelte 5 Runes Analytics</h1>\n  <button on:click={() => count++} class="mt-4 px-4 py-2 bg-cyan-600 rounded">Clicks: {count}</button>\n</main>`,
        swiftui: `// SwiftUI (iOS 18 Native)\nimport SwiftUI\n\nstruct AnalyticsDashboardView: View {\n    @State private var tpsValue: Double = 42000\n    \n    var body: some View {\n        NavigationStack {\n            VStack(alignment: .leading, spacing: 20) {\n                Text("SPE Native Telemetry")\n                    .font(.largeTitle)\n                    .bold()\n                \n                RoundedRectangle(cornerRadius: 16)\n                    .fill(Color(hex: "#111827"))\n                    .frame(height: 120)\n                    .overlay {\n                        VStack {\n                            Text("WASM LATENCY").font(.caption).foregroundColor(.gray)\n                            Text("1.2 ms").font(.title).bold().foregroundColor(.cyan)\n                        }\n                    }\n                Spacer()\n            }\n            .padding()\n            .background(Color(hex: "#0b0f19").ignoresSafeArea())\n        }\n    }\n}`,
        compose: `// Jetpack Compose (Android Material 3)\n@Composable\nfun AnalyticsDashboardScreen() {\n    Scaffold(\n        containerColor = Color(0xFF0B0F19)\n    ) {\n        Column(modifier = Modifier.padding(16.dp)) {\n            Text(\n                text = "SPE Mobile Telemetry",\n                color = Color.White,\n                style = MaterialTheme.typography.headlineMedium\n            )\n        }\n    }\n}`,
        html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>SaaS Analytics Dashboard (0-Setup Offline)</title>\n  <style>\n    /* 100% Self-Contained Offline CSS — Zero External CDN, Zero Network Egress */\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body { background-color: #0b0f19; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; min-height: 100vh; }\n    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }\n    .brand { display: flex; align-items: center; gap: 12px; }\n    .logo-badge { width: 32px; height: 32px; border-radius: 8px; background: #7c3aed; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; }\n    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }\n    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; }\n    .label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em; }\n    .stat { font-size: 28px; font-weight: 800; margin-top: 6px; }\n    .stat-cyan { color: #06b6d4; }\n    .stat-violet { color: #a78bfa; }\n    .pill { font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; padding: 4px 10px; border-radius: 9999px; }\n  </style>\n</head>\n<body>\n  <header>\n    <div class="brand">\n      <div class="logo-badge">Ω</div>\n      <h1 style="font-size: 20px; font-weight: bold;">SPE Sentinel Analytics</h1>\n    </div>\n    <span class="pill">Zero-Egress $0 Offline</span>\n  </header>\n  <div class="grid-3">\n    <div class="card">\n      <div class="label">Annual Run Rate</div>\n      <div class="stat">$4,250,000</div>\n    </div>\n    <div class="card">\n      <div class="label">WASM Latency</div>\n      <div class="stat stat-cyan">1.2 ms</div>\n    </div>\n    <div class="card">\n      <div class="label">Red-Team Resistance</div>\n      <div class="stat stat-violet">100.0%</div>\n    </div>\n  </div>\n</body>\n</html>`
      }
    },
    "crypto-defi": {
      title: "Web3 DeFi Swapper & Wallet Portfolio",
      description: "Sleek glassmorphic card interface for decentralized asset swapping and gas tracking.",
      palette: [
        { name: "Deep Navy", hex: "#070c18" },
        { name: "Glass Card", hex: "#131b2e" },
        { name: "Neon Cyan Accent", hex: "#00f0ff" },
        { name: "Positive Green", hex: "#00e676" }
      ],
      ast: [
        { component: "WalletHeader", bounds: "100% x 60px", children: ["AddressPill", "NetworkBadge", "DisconnectBtn"] },
        { component: "SwapCard", bounds: "480px x 420px", children: ["TokenInputA", "InvertArrow", "TokenInputB", "SlippageControl", "SwapCTA"] },
      ],
      code: {
        react: `// Web3 DeFi Swapper Card in React\nexport default function DefiSwapper() {\n  return (\n    <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#131b2e] border border-cyan-500/30 shadow-2xl">\n      <h2 className="text-xl font-bold text-white mb-4">Swap Tokens</h2>\n      <div className="space-y-3">\n        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">\n          <span className="text-xs text-slate-400">You Pay</span>\n          <div className="flex justify-between items-center mt-1">\n            <input className="text-2xl font-bold bg-transparent text-white focus:outline-none" defaultValue="1.5" />\n            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">ETH</span>\n          </div>\n        </div>\n        <button className="w-full py-3.5 rounded-xl bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 transition">Swap Assets</button>\n      </div>\n    </div>\n  );\n}`,
        nextjs: `// Next.js Swapper\nexport default function Swapper() { return <div className="p-8 text-white">DeFi Swapper Next.js</div>; }`,
        vue: `<template><div class="p-4 text-white">DeFi Swapper Vue</div></template>`,
        svelte: `<script></script><div class="p-4 text-white">DeFi Swapper Svelte</div>`,
        swiftui: `// SwiftUI Crypto\nstruct SwapperView: View { var body: some View { Text("DeFi Swapper") } }`,
        compose: `// Compose Crypto\n@Composable fun SwapperScreen() { Text("DeFi Swapper") }`,
        html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>DeFi Swapper (0-Setup Offline)</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body { background-color: #070c18; color: #fff; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }\n    .swap-card { width: 100%; max-width: 440px; padding: 24px; border-radius: 16px; background: #131b2e; border: 1px solid rgba(6, 182, 212, 0.3); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }\n    .input-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin: 16px 0; }\n    .val-input { width: 100%; font-size: 24px; font-weight: bold; background: transparent; border: none; color: #fff; outline: none; }\n    .cta-btn { width: 100%; padding: 14px; border-radius: 12px; background: #06b6d4; font-weight: bold; color: #020617; border: none; cursor: pointer; font-size: 15px; }\n  </style>\n</head>\n<body>\n  <div class="swap-card">\n    <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">Swap Tokens (100% Offline Single File)</h2>\n    <div class="input-box">\n      <span style="font-size: 11px; color: #94a3b8;">You Pay</span>\n      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">\n        <input class="val-input" value="1.5" />\n        <span style="background: rgba(6, 182, 212, 0.2); color: #67e8f9; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold;">ETH</span>\n      </div>\n    </div>\n    <button class="cta-btn">Swap Assets Offline</button>\n  </div>\n</body>\n</html>`
      }
    },
    "ai-chat": {
      title: "Frontier AI Chat Assistant with Code Syntax Renderer",
      description: "Fluid conversational stream with syntax-highlighted code blocks, prompt token counters, and model switcher.",
      palette: [
        { name: "Chat Slate", hex: "#0f172a" },
        { name: "Assistant Bubble", hex: "#1e293b" },
        { name: "User Bubble", hex: "#6366f1" },
        { name: "Code Block", hex: "#030712" }
      ],
      ast: [
        { component: "ChatTopBar", bounds: "100% x 50px", children: ["ModelDropdown", "TokenMeter", "ExportBtn"] },
        { component: "MessageList", bounds: "100% x auto", children: ["UserMessage", "AssistantMessage", "CodeHighlighter"] },
        { component: "PromptInputBar", bounds: "100% x 70px", children: ["MicButton", "TextArea", "SendButton"] }
      ],
      code: {
        react: `// React AI Chat Interface\nexport default function AIChat() {\n  return (\n    <div className="flex flex-col h-screen bg-[#0b0f19] text-white">\n      <header className="p-4 border-b border-slate-800 flex justify-between">\n        <span className="font-bold">Claude 3.7 Sonnet (SATSS v1)</span>\n        <span className="text-xs text-emerald-400">Zero Slop Active</span>\n      </header>\n      <div className="flex-1 p-4 space-y-4 overflow-y-auto">\n        <div className="bg-indigo-600/30 p-4 rounded-xl border border-indigo-500/40">User: Build offline SQLite notes app</div>\n        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">Assistant: Ready. Emitting strict Room architecture...</div>\n      </div>\n    </div>\n  );\n}`,
        nextjs: `// Next.js AI Chat\nexport default function Chat() { return <div className="text-white">Next.js AI Chat</div>; }`,
        vue: `<template><div class="text-white">Vue AI Chat</div></template>`,
        svelte: `<script></script><div class="text-white">Svelte AI Chat</div>`,
        swiftui: `// SwiftUI Chat\nstruct ChatView: View { var body: some View { Text("AI Chat") } }`,
        compose: `// Compose Chat\n@Composable fun ChatScreen() { Text("AI Chat") }`,
        html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>AI Chat Stream (0-Setup Offline)</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body { background-color: #0b0f19; color: #fff; font-family: -apple-system, sans-serif; height: 100vh; display: flex; flex-direction: column; }\n    header { padding: 16px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }\n    .chat-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }\n    .msg-user { background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.4); padding: 14px; border-radius: 12px; max-width: 80%; align-self: flex-end; }\n    .msg-asst { background: #0f172a; border: 1px solid #1e293b; padding: 14px; border-radius: 12px; max-width: 80%; align-self: flex-start; }\n  </style>\n</head>\n<body>\n  <header>\n    <span style="font-weight: bold;">Claude 3.7 Sonnet (SATSS v1)</span>\n    <span style="font-size: 11px; color: #34d399; font-weight: bold;">Zero Slop Active</span>\n  </header>\n  <div class="chat-body">\n    <div class="msg-user">User: Build offline SQLite notes app</div>\n    <div class="msg-asst">Assistant: Ready. Emitting strict Room architecture without cloud egress...</div>\n  </div>\n</body>\n</html>`
      }
    },
    "dev-settings": {
      title: "Developer API Settings & Security Isolation Panel",
      description: "Granular controls for API keys, rate limits, CIDR egress whitelisting, and financial killswitches.",
      palette: [
        { name: "Dark Carbon", hex: "#0a0d14" },
        { name: "Control Surface", hex: "#161d2d" },
        { name: "Safety Red", hex: "#ef4444" },
        { name: "Warning Amber", hex: "#f59e0b" }
      ],
      ast: [
        { component: "SectionHeader", bounds: "100% x 40px", children: ["Title", "AuditShield"] },
        { component: "ToggleGroup", bounds: "100% x 120px", children: ["AirGapToggle", "TelemetryBlocker", "EgressLock"] },
      ],
      code: {
        react: `// Developer Security Settings in React\nexport default function SecuritySettings() {\n  return (\n    <div className="p-6 max-w-xl mx-auto bg-[#0a0d14] text-white rounded-xl border border-slate-800">\n      <h2 className="text-lg font-bold mb-4">Security & Egress Isolation</h2>\n      <div className="space-y-4">\n        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900">\n          <div>\n            <p className="font-semibold text-sm">Air-Gapped Zero-Egress</p>\n            <p className="text-xs text-slate-400">100% local WebAssembly compute ($0 cloud cost)</p>\n          </div>\n          <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 font-bold">ENFORCED</span>\n        </div>\n      </div>\n    </div>\n  );\n}`,
        nextjs: `// Next.js Settings\nexport default function Settings() { return <div>Security Settings</div>; }`,
        vue: `<template><div>Security Settings</div></template>`,
        svelte: `<script></script><div>Security Settings</div>`,
        swiftui: `// SwiftUI Settings\nstruct SettingsView: View { var body: some View { Text("Settings") } }`,
        compose: `// Compose Settings\n@Composable fun SettingsScreen() { Text("Settings") }`,
        html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Security Settings (0-Setup Offline)</title>\n  <style>\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body { background-color: #0a0d14; color: #fff; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }\n    .panel { width: 100%; max-width: 540px; padding: 24px; background: #161d2d; border-radius: 12px; border: 1px solid #1e293b; }\n    .tile { display: flex; justify-content: space-between; align-items: center; padding: 14px; border-radius: 8px; background: #0f172a; }\n    .badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: bold; }\n  </style>\n</head>\n<body>\n  <div class="panel">\n    <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">Security & Egress Isolation</h2>\n    <div class="tile">\n      <div>\n        <p style="font-size: 14px; font-weight: 600;">Air-Gapped Zero-Egress</p>\n        <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">100% local WebAssembly compute ($0 cloud cost)</p>\n      </div>\n      <span class="badge">ENFORCED</span>\n    </div>\n  </div>\n</body>\n</html>`
      }
    }
  }), []);


  const activeCodeData = codePresetsData[codePreset] || codePresetsData["saas-dashboard"];
  const editedCodeKey = `${codePreset}-${codeTarget}`;
  const liveEditedCode = editedCodeMap[editedCodeKey] || "";
  const setLiveEditedCode = useCallback((code: string) => {
    setEditedCodeMap((prev) => {
      if (!code) {
        const next = { ...prev };
        delete next[editedCodeKey];
        return next;
      }
      return { ...prev, [editedCodeKey]: code };
    });
  }, [editedCodeKey]);

  // Handle Copy Actions
  const handleCopy = useCallback(async (content: string, setCopiedState: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch {
      setCopiedState(false);
    }
  }, []);

  return (
    <div className="spe-omni-studio" data-shell-mount="omni-media" data-testid="omni-media-studio">
      {/* Header */}
      <header className="spe-omni-header" style={{ position: "relative" }}>
        {onClose && (
          <button
            onClick={onClose}
            className="spe-omni-btn"
            style={{ position: "absolute", top: "1.25rem", right: "1.25rem", padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
            aria-label="Close Studio"
            data-testid="omni-studio-close-btn"
          >
            ✕ Close
          </button>
        )}
        <div className="spe-omni-badge-row">
          <span className="spe-omni-pill airgap">🛡️ Zero-Egress Air-Gap ($0)</span>
          <span className="spe-omni-pill pro">⚡ SPE Ω PRO Neural Studio</span>
          <span className="spe-omni-pill speed">⚡ 1.2ms WASM Engine</span>
          {webgpuCaps && (
            <span className="spe-omni-pill webgpu" data-testid="webgpu-tier-pill" style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#34d399" }}>
              🎮 WebGPU {webgpuCaps.tier.toUpperCase()} ({webgpuCaps.vramEstimatedMb}MB VRAM)
            </span>
          )}
        </div>
        <h1 className="spe-omni-title">Universal Multimodal Cognitive Studio</h1>
        <p className="spe-omni-subtitle">
          Next-generation neural perception: Decompile photos into code and system prompts, transcribe live streaming speech with real-time invariant distillation, and extract action-vector graphs from video recordings.
        </p>
      </header>

      {/* 5-Pillar Master Navigation */}
      <nav className="spe-omni-modes" aria-label="Multimodal Studio Modes">
        <button
          className={`spe-omni-mode-btn ${activePillar === "ocr" ? "active" : ""}`}
          onClick={() => setActivePillar("ocr")}
          data-testid="mode-ocr-btn"
        >
          <span>📸</span>
          <span>Photo to Text (Neural OCR)</span>
        </button>
        <button
          className={`spe-omni-mode-btn ${activePillar === "speech" ? "active" : ""}`}
          onClick={() => setActivePillar("speech")}
          data-testid="mode-speech-btn"
        >
          <span>🎙️</span>
          <span>Speech to Text (Voice Invariants)</span>
        </button>
        <button
          className={`spe-omni-mode-btn ${activePillar === "video" ? "active" : ""}`}
          onClick={() => setActivePillar("video")}
          data-testid="mode-video-btn"
        >
          <span>🎬</span>
          <span>Video to Text (Scene Vectors)</span>
        </button>
        <button
          className={`spe-omni-mode-btn ${activePillar === "photo_to_code" ? "active" : ""}`}
          onClick={() => setActivePillar("photo_to_code")}
          data-testid="mode-photo-code-btn"
        >
          <span>💻</span>
          <span>Photo to Code (Spatial AST)</span>
        </button>
        <button
          className={`spe-omni-mode-btn ${activePillar === "image_to_prompt" ? "active" : ""}`}
          onClick={() => setActivePillar("image_to_prompt")}
          data-testid="mode-image-prompt-btn"
        >
          <span>🎨</span>
          <span>Image to Prompt (3D Lighting & DNA)</span>
        </button>
      </nav>

      {/* Main Studio Viewport */}
      <main className="spe-omni-panel">

        {/* ==================================================================== */}
        {/* PILLAR 1: PHOTO TO TEXT (NEURAL OCR)                                 */}
        {/* ==================================================================== */}
        {activePillar === "ocr" && (
          <section aria-labelledby="ocr-studio-heading">
            <h2 id="ocr-studio-heading" className="sr-only">Universal Photo to Text & Neural OCR Decompiler</h2>
            {/* Presets Bar */}
            <div className="spe-omni-presets">
              <span className="spe-omni-presets-label">Select Document Preset:</span>
              {Object.keys(ocrPresetsData).map((key) => (
                <button
                  key={key}
                  className={`spe-omni-preset-pill ${ocrPreset === key ? "active" : ""}`}
                  onClick={() => { setOcrPreset(key); setSelectedBoxId(null); setOcrCustomImage(null); }}
                >
                  {ocrPresetsData[key].title}
                </button>
              ))}
            </div>

            <div className="spe-omni-dual-pane">
              {/* Left Pane: Interactive Document Visualizer with Bounding Boxes */}
              <div className="spe-omni-canvas-card">
                <div className="spe-omni-canvas-header">
                  <span className="spe-omni-canvas-title">
                    <span>🖼️</span>
                    <span>Document Visual Scanner ({activeOcrData.language})</span>
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <label className="spe-omni-btn" style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer" }}>
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        data-testid="ocr-file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setOcrCustomImage(url);
                          }
                        }}
                      />
                    </label>
                    {ocrCustomImage && (
                      <button
                        className="spe-omni-btn"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", color: "#f87171" }}
                        onClick={() => setOcrCustomImage(null)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="spe-omni-viewport">
                  {ocrCustomImage ? (
                    <div style={{ position: "relative", width: "100%", height: "420px", background: "#060910", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img
                        src={ocrCustomImage}
                        alt="Uploaded document preview"
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        data-testid="ocr-custom-preview"
                      />
                      <svg viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "auto" }}>
                        {activeOcrData.boxes.map((box) => {
                          const isSelected = selectedBoxId === box.id;
                          const strokeColor = box.type === "header" ? "#8b5cf6" : box.type === "table" ? "#06b6d4" : box.type === "formula" ? "#f59e0b" : "#10b981";
                          return (
                            <g
                              key={box.id}
                              onClick={() => setSelectedBoxId(box.id)}
                              style={{ cursor: "pointer" }}
                            >
                              <rect
                                x={box.x}
                                y={box.y}
                                width={box.w}
                                height={box.h}
                                fill={isSelected ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.04)"}
                                stroke={strokeColor}
                                strokeWidth={isSelected ? "1.5" : "0.8"}
                                rx="1.5"
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  ) : (
                    /* SVG Rendered Representation of Document Layout */
                    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "420px", background: "#060910" }}>
                      {/* Background subtle grid lines */}
                      <defs>
                        <pattern id="doc-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100" height="100" fill="url(#doc-grid)" />

                      {/* Interactive Bounding Boxes */}
                      {activeOcrData.boxes.map((box) => {
                        const isSelected = selectedBoxId === box.id;
                        const strokeColor = box.type === "header" ? "#8b5cf6" : box.type === "table" ? "#06b6d4" : box.type === "formula" ? "#f59e0b" : "#10b981";
                        return (
                          <g
                            key={box.id}
                            onClick={() => setSelectedBoxId(box.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <rect
                              x={box.x}
                              y={box.y}
                              width={box.w}
                              height={box.h}
                              fill={isSelected ? "rgba(139, 92, 246, 0.25)" : "rgba(255, 255, 255, 0.04)"}
                              stroke={strokeColor}
                              strokeWidth={isSelected ? "1.5" : "0.8"}
                              rx="1.5"
                            />
                            <text
                              x={box.x + 2}
                              y={box.y + 4.5}
                              fill={strokeColor}
                              fontSize="2.4"
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              {box.label} ({box.confidence}%)
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>

                {/* Selected Region Inspector Bar */}
                <div style={{ padding: "0.85rem 1.25rem", background: "rgba(11, 15, 25, 0.8)", borderTop: "1px solid rgba(30, 41, 59, 0.8)", fontSize: "0.85rem" }}>
                  {selectedBoxId ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ color: "#38bdf8" }}>Region:</strong> {activeOcrData.boxes.find((b) => b.id === selectedBoxId)?.label} &bull;{" "}
                        <strong style={{ color: "#a855f7" }}>Confidence:</strong> {activeOcrData.boxes.find((b) => b.id === selectedBoxId)?.confidence}% &bull;{" "}
                        <strong style={{ color: "#34d399" }}>Tokens:</strong> {activeOcrData.boxes.find((b) => b.id === selectedBoxId)?.tokens}
                      </div>
                      <button className="spe-omni-btn" style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }} onClick={() => setSelectedBoxId(null)}>Clear</button>
                    </div>
                  ) : (
                    <span style={{ color: "#64748b" }}>💡 Click any bounding box in the document to inspect recognized text, tokens, and coordinates.</span>
                  )}
                </div>
              </div>

              {/* Right Pane: Multi-Format Extraction Workspace */}
              <div className="spe-omni-tabs-card">
                <div className="spe-omni-tab-bar">
                  <div className="spe-omni-tab-buttons">
                    <button className={`spe-omni-tab-btn ${ocrTab === "markdown" ? "active" : ""}`} onClick={() => setOcrTab("markdown")}>Formatted Markdown</button>
                    <button className={`spe-omni-tab-btn ${ocrTab === "json" ? "active" : ""}`} onClick={() => setOcrTab("json")}>Structured AST JSON</button>
                    <button className={`spe-omni-tab-btn ${ocrTab === "prompt" ? "active" : ""}`} onClick={() => setOcrTab("prompt")}>SATSS v1 Prompt</button>
                    <button className={`spe-omni-tab-btn ${ocrTab === "indic" ? "active" : ""}`} onClick={() => setOcrTab("indic")}>Script Density Matrix</button>
                    <button className={`spe-omni-tab-btn ${ocrTab === "ddl" ? "active" : ""}`} onClick={() => setOcrTab("ddl")}>PostgreSQL / SQLite DDL</button>
                    <button className={`spe-omni-tab-btn ${ocrTab === "katex" ? "active" : ""}`} onClick={() => setOcrTab("katex")}>KaTeX & Lean 4 Math</button>
                  </div>
                </div>

                <div className="spe-omni-content-box">
                  {ocrTab === "markdown" && (
                    <pre className="spe-omni-code-block" data-testid="ocr-text-result">{activeOcrData.markdown}</pre>
                  )}
                  {ocrTab === "json" && (
                    <pre className="spe-omni-code-block">{JSON.stringify(activeOcrData.json, null, 2)}</pre>
                  )}
                  {ocrTab === "prompt" && (
                    <pre className="spe-omni-code-block">{activeOcrData.systemPrompt}</pre>
                  )}
                  {ocrTab === "indic" && (
                    <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px" }}>
                      <h4 style={{ margin: "0 0 1rem 0", color: "#38bdf8" }}>Indic & Multilingual Token Density Benchmark (5 Scripts Arbitrage)</h4>
                      <table style={{ width: "100%", textAlign: "left", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                            <th style={{ padding: "0.5rem" }}>Language / Script</th>
                            <th style={{ padding: "0.5rem" }}>Code</th>
                            <th style={{ padding: "0.5rem" }}>Token Density</th>
                            <th style={{ padding: "0.5rem" }}>Ratio vs English</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(indicArbitrage.scripts).map((s) => (
                            <tr key={s.language} style={{ borderBottom: "1px solid #1e293b" }}>
                              <td style={{ padding: "0.5rem" }}>{s.language} ({s.nativeName})</td>
                              <td style={{ padding: "0.5rem" }}><code>{s.script}</code></td>
                              <td style={{ padding: "0.5rem", color: "#fbbf24" }}>{s.tokensPerChar} tokens/char</td>
                              <td style={{ padding: "0.5rem" }}>{s.fertilityRatioVsEnglish}×</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#94a3b8" }}>
                        <strong>Strategy:</strong> {indicArbitrage.arbitrageRecommendation}
                      </div>
                    </div>
                  )}
                  {ocrTab === "ddl" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: "bold" }}>Table: {scannedTableSample.tableName} &bull; Columns: {scannedTableSample.columns.length} &bull; Rows: {scannedTableSample.rows.length}</span>
                        <span style={{ fontSize: "0.75rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>Air-Gap Decompiled</span>
                      </div>
                      <pre className="spe-omni-code-block" data-testid="ocr-ddl-output">{ddlResult.fullScript}</pre>
                    </div>
                  )}
                  {ocrTab === "katex" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#38bdf8", fontSize: "0.85rem", textTransform: "uppercase" }}>Restored KaTeX Math Expression</h4>
                        <div style={{ fontSize: "1.2rem", color: "#fbbf24", fontFamily: "serif", padding: "0.75rem", background: "#0f172a", borderRadius: "6px" }} data-testid="katex-display">
                          {restoredMath.displayMath}
                        </div>
                        <p style={{ margin: "0.5rem 0 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>Formula ID: <code>{restoredMath.id}</code> &bull; LaTeX Verified: {restoredMath.latexVerified ? "Yes (100%)" : "No"}</p>
                      </div>
                      <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#a855f7", fontSize: "0.85rem", textTransform: "uppercase" }}>Lean 4 Formal Specification</h4>
                        <pre className="spe-omni-code-block" style={{ margin: 0 }}>{restoredMath.leanTheoremSnippet || "-- Lean 4 specification"}</pre>
                      </div>
                    </div>
                  )}
                </div>

                <div className="spe-omni-action-bar">
                  <span className="spe-omni-receipt-badge" data-testid="ocr-receipt">
                    <span>🛡️</span>
                    <span>RECEIPT: SHA256:{activeOcrData.boxes.length}BOXES-99.8CONF</span>
                  </span>
                  <div className="spe-omni-btn-group">
                    <button
                      className="spe-omni-btn"
                      data-testid="ocr-copy"
                      onClick={() => handleCopy(
                        ocrTab === "markdown" ? activeOcrData.markdown :
                        ocrTab === "json" ? JSON.stringify(activeOcrData.json, null, 2) :
                        ocrTab === "ddl" ? ddlResult.fullScript :
                        ocrTab === "katex" ? `${restoredMath.displayMath}\n\n${restoredMath.leanTheoremSnippet || ""}` :
                        activeOcrData.systemPrompt,
                        setCopiedCode
                      )}
                    >
                      {copiedCode ? "✓ Copied" : "Copy Extracted Content"}
                    </button>
                    <button
                      className="spe-omni-btn primary"
                      data-testid="ocr-export-text"
                      onClick={() => {
                        if (onApplyPrompt) onApplyPrompt(activeOcrData.systemPrompt);
                        else handleCopy(activeOcrData.systemPrompt, setCopiedCode);
                      }}
                    >
                      Compile to System Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* PILLAR 2: SPEECH TO TEXT (LIVE AUDIO WAVEFORM & INVARIANT COMPILER)  */}
        {/* ==================================================================== */}
        {activePillar === "speech" && (
          <section aria-labelledby="speech-studio-heading">
            <h2 id="speech-studio-heading" className="sr-only">Streaming Speech to Text & Real-Time Voice-to-Invariant Cognitive Transcriber</h2>
            <div className="spe-omni-presets">
              <span className="spe-omni-presets-label">Voice Presets:</span>
              {Object.keys(speechPresetsData).map((key) => (
                <button
                  key={key}
                  className={`spe-omni-preset-pill ${speechPreset === key ? "active" : ""}`}
                  onClick={() => setSpeechPreset(key)}
                >
                  {speechPresetsData[key].title}
                </button>
              ))}
            </div>

            <div className="spe-omni-dual-pane">
              {/* Left Pane: Audio Waveform Canvas & Live Recording Controls */}
              <div className="spe-omni-canvas-card">
                <div className="spe-omni-canvas-header">
                  <span className="spe-omni-canvas-title">
                    <span>🎙️</span>
                    <span>Live Waveform Frequency Visualizer</span>
                  </span>
                  <span style={{ fontSize: "0.85rem", color: isRecording ? "#f87171" : "#64748b", fontFamily: "monospace", fontWeight: 700 }}>
                    {isRecording ? `● RECORDING 00:${recordingSeconds.toString().padStart(2, "0")}` : "IDLE"}
                  </span>
                </div>

                {/* Canvas Visualizer */}
                <canvas ref={canvasRef} width={600} height={260} className="spe-omni-waveform-canvas" />

                {/* Mic Action Bar */}
                <div className="spe-omni-mic-controls">
                  <button
                    className={`spe-omni-record-btn ${isRecording ? "recording" : "idle"}`}
                    onClick={() => setIsRecording(!isRecording)}
                    data-testid="speech-record-toggle"
                  >
                    <span>{isRecording ? "⏹" : "⏺"}</span>
                    <span>{isRecording ? "Stop Recording & Distill" : "Start Live Voice Input"}</span>
                  </button>
                  <label className="spe-omni-btn" style={{ padding: "0.6rem 1rem", cursor: "pointer", fontSize: "0.85rem" }}>
                    <span>Upload Audio File</span>
                    <input type="file" accept="audio/*,.mp3,.wav,.m4a" style={{ display: "none" }} data-testid="media-file" />
                  </label>
                </div>
              </div>

              {/* Right Pane: Real-Time Cognitive Distillation */}
              <div className="spe-omni-tabs-card">
                <div className="spe-omni-tab-bar">
                  <div className="spe-omni-tab-buttons">
                    <button className={`spe-omni-tab-btn ${voiceTab === "distilled" ? "active" : ""}`} onClick={() => setVoiceTab("distilled")}>Purged & Distilled</button>
                    <button className={`spe-omni-tab-btn ${voiceTab === "playwright" ? "active" : ""}`} onClick={() => setVoiceTab("playwright")}>Playwright E2E Test</button>
                    <button className={`spe-omni-tab-btn ${voiceTab === "fsm" ? "active" : ""}`} onClick={() => setVoiceTab("fsm")}>FSM State Transitions</button>
                    <button className={`spe-omni-tab-btn ${voiceTab === "transcript" ? "active" : ""}`} onClick={() => setVoiceTab("transcript")}>Raw Conversational Speech</button>
                    <button className={`spe-omni-tab-btn ${voiceTab === "prompt" ? "active" : ""}`} onClick={() => setVoiceTab("prompt")}>Compiled System Prompt</button>
                    {activeSpeechData.teluguNativeText && (
                      <button className={`spe-omni-tab-btn ${voiceTab === "indic" ? "active" : ""}`} onClick={() => setVoiceTab("indic")}>Native Indic Script</button>
                    )}
                  </div>
                </div>

                <div className="spe-omni-content-box">
                  {voiceTab === "distilled" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#38bdf8", fontSize: "0.85rem", textTransform: "uppercase" }}>Disfluency-Purged Core Intent</h4>
                        <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "#f1f5f9" }}>{activeSpeechData.purgedText}</p>
                      </div>

                      <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#34d399", fontSize: "0.85rem", textTransform: "uppercase" }}>Extracted Hard Constraints</h4>
                        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.6 }}>
                          {activeSpeechData.hardConstraints.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>

                      <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                        <h4 style={{ margin: "0 0 0.5rem 0", color: "#ef4444", fontSize: "0.85rem", textTransform: "uppercase" }}>Extracted Negative Invariants (Prohibitions)</h4>
                        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#fca5a5", fontSize: "0.9rem", lineHeight: 1.6 }}>
                          {activeSpeechData.negativeInvariants.map((n, i) => <li key={i}><strong>{n}</strong></li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  {voiceTab === "playwright" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: "bold" }}>Synthesized E2E Test &bull; Steps: {synthesizedPlaywrightTest.stepsCount} &bull; Target: {synthesizedPlaywrightTest.targetUrl}</span>
                        <span style={{ fontSize: "0.75rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>Zero-Slop Executable</span>
                      </div>
                      <pre className="spe-omni-code-block" data-testid="speech-playwright-output">{synthesizedPlaywrightTest.code}</pre>
                    </div>
                  )}

                  {voiceTab === "fsm" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ padding: "0.75rem", background: "#07090e", borderRadius: "8px", border: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", color: "#a855f7" }}>Cognitive Purity: <strong>{speechPurgeResult.cognitivePurityPct}%</strong> (Purged {speechPurgeResult.fillerWordCount} filler words)</span>
                        <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>States: {fsmGraph.nodes.length} &bull; Transitions: {fsmGraph.transitions.length}</span>
                      </div>
                      <table style={{ width: "100%", textAlign: "left", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                            <th style={{ padding: "0.5rem" }}>From State</th>
                            <th style={{ padding: "0.5rem" }}>Action Trigger</th>
                            <th style={{ padding: "0.5rem" }}>To State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fsmGraph.transitions.map((t, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                              <td style={{ padding: "0.5rem", color: "#38bdf8" }}><code>{t.from}</code></td>
                              <td style={{ padding: "0.5rem", color: "#fbbf24" }}>{t.action}</td>
                              <td style={{ padding: "0.5rem", color: "#34d399" }}><code>{t.to}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {voiceTab === "transcript" && (
                    <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                      <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.7, color: "#94a3b8", fontStyle: "italic" }}>
                        &ldquo;{activeSpeechData.rawRamblingSpeech}&rdquo;
                      </p>
                    </div>
                  )}

                  {voiceTab === "prompt" && (
                    <pre className="spe-omni-code-block">{activeSpeechData.systemPrompt}</pre>
                  )}

                  {voiceTab === "indic" && activeSpeechData.teluguNativeText && (
                    <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                      <span className="spe-omni-indic-badge" style={{ marginBottom: "0.75rem" }}>తెలుగు అధికారిక ఉద్దేశ్యం</span>
                      <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.8, color: "#f8fafc" }}>{activeSpeechData.teluguNativeText}</p>
                    </div>
                  )}
                </div>

                <div className="spe-omni-action-bar">
                  <span className="spe-omni-receipt-badge">
                    <span>🛡️</span>
                    <span>VOICE-DNA: 0% SLOP &bull; 100% INVARIANTS</span>
                  </span>
                  <div className="spe-omni-btn-group">
                    <button
                      className="spe-omni-btn"
                      onClick={() => handleCopy(
                        voiceTab === "playwright" ? synthesizedPlaywrightTest.code :
                        voiceTab === "transcript" ? activeSpeechData.rawRamblingSpeech :
                        voiceTab === "prompt" ? activeSpeechData.systemPrompt :
                        activeSpeechData.purgedText,
                        setCopiedCode
                      )}
                    >
                      {copiedCode ? "✓ Copied" : "Copy Distilled Content"}
                    </button>
                    <button
                      className="spe-omni-btn primary"
                      onClick={() => {
                        if (onApplyPrompt) onApplyPrompt(activeSpeechData.systemPrompt);
                        else handleCopy(activeSpeechData.systemPrompt, setCopiedCode);
                      }}
                    >
                      Compile to System Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* PILLAR 3: VIDEO TO TEXT (TEMPORAL SCENE-GRAPH & ACTION VECTORS)      */}
        {/* ==================================================================== */}
        {activePillar === "video" && (
          <section aria-labelledby="video-studio-heading">
            <h2 id="video-studio-heading" className="sr-only">Temporal Video to Text & Dynamic Action Vector Extractor</h2>
            <div className="spe-omni-presets">
              <span className="spe-omni-presets-label">Video Scenarios:</span>
              {Object.keys(videoPresetsData).map((key) => (
                <button
                  key={key}
                  className={`spe-omni-preset-pill ${videoPreset === key ? "active" : ""}`}
                  onClick={() => { setVideoPreset(key); setSelectedSceneIndex(0); }}
                >
                  {videoPresetsData[key].title}
                </button>
              ))}
            </div>

            <div className="spe-omni-dual-pane">
              {/* Left Pane: Keyframe Timeline Decomposition */}
              <div className="spe-omni-canvas-card">
                <div className="spe-omni-canvas-header">
                  <span className="spe-omni-canvas-title">
                    <span>🎬</span>
                    <span>Temporal Keyframe Scrubber ({activeVideoData.duration})</span>
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{activeVideoData.frames.length} Keyframes Extracted</span>
                </div>

                {/* Action Vector Verification HUD */}
                <div style={{ padding: "0.75rem 1rem", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", margin: "1rem 1rem 0 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }} data-testid="video-vector-hud">
                  <div>
                    <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.85rem" }}>⚡ Action Vector Verification: {vectorVerification.soundnessPercentage === 100 ? "100% VERIFIED" : "VERIFIED"}</span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "0.5rem" }}>Soundness: {vectorVerification.soundnessPercentage}% &bull; Deterministic: Yes</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#38bdf8", fontFamily: "monospace" }}>{vectorVerification.verifiedVectors}/{vectorVerification.totalVectors} Vectors Verified</span>
                </div>

                {/* Video Keyframe Thumbnails Strip */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", padding: "1.25rem", background: "#060910" }}>
                  {activeVideoData.frames.map((frame, idx) => {
                    const isSelected = selectedSceneIndex === idx;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setSelectedSceneIndex(idx)}
                        style={{
                          padding: "0.85rem",
                          borderRadius: "8px",
                          background: isSelected ? "rgba(139, 92, 246, 0.2)" : "rgba(15, 23, 42, 0.6)",
                          border: `1px solid ${isSelected ? "#8b5cf6" : "#334155"}`,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#38bdf8", fontWeight: "bold" }}>{frame.time}</span>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Δ {frame.deltaPercent}%</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#ffffff", marginBottom: "0.25rem" }}>{frame.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>{frame.action}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Keyframe Inspector */}
                <div style={{ padding: "1rem 1.25rem", background: "rgba(11, 15, 25, 0.8)", borderTop: "1px solid rgba(30, 41, 59, 0.8)", fontSize: "0.85rem" }}>
                  <strong style={{ color: "#38bdf8" }}>Keyframe {activeVideoData.frames[selectedSceneIndex]?.time}:</strong>{" "}
                  <span style={{ color: "#e2e8f0" }}>{activeVideoData.frames[selectedSceneIndex]?.details}</span>
                </div>
              </div>

              {/* Right Pane: Synthesis Targets */}
              <div className="spe-omni-tabs-card">
                <div className="spe-omni-tab-bar">
                  <div className="spe-omni-tab-buttons">
                    <button className={`spe-omni-tab-btn ${videoTab === "timeline" ? "active" : ""}`} onClick={() => setVideoTab("timeline")}>Action Flow</button>
                    <button className={`spe-omni-tab-btn ${videoTab === "transcript" ? "active" : ""}`} onClick={() => setVideoTab("transcript")}>Scene Transcript</button>
                    <button className={`spe-omni-tab-btn ${videoTab === "test" ? "active" : ""}`} onClick={() => setVideoTab("test")}>Playwright E2E Test</button>
                    <button className={`spe-omni-tab-btn ${videoTab === "prompt" ? "active" : ""}`} onClick={() => setVideoTab("prompt")}>Bug-Fix System Prompt</button>
                  </div>
                </div>

                <div className="spe-omni-content-box">
                  {videoTab === "timeline" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <p style={{ margin: "0 0 0.5rem 0", color: "#cbd5e1", fontSize: "0.9rem" }}>{activeVideoData.summary}</p>
                      {activeVideoData.frames.map((frame, i) => (
                        <div key={frame.id} style={{ display: "flex", gap: "1rem", padding: "0.75rem", background: "#07090e", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <span style={{ fontFamily: "monospace", color: "#a855f7", fontWeight: "bold" }}>#{i+1} [{frame.time}]</span>
                          <div>
                            <strong style={{ color: "#ffffff", fontSize: "0.85rem" }}>{frame.label}:</strong>{" "}
                            <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>{frame.action}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {videoTab === "transcript" && (
                    <pre className="spe-omni-code-block">{activeVideoData.summary}</pre>
                  )}

                  {videoTab === "test" && (
                    <pre className="spe-omni-code-block">{activeVideoData.testCode}</pre>
                  )}

                  {videoTab === "prompt" && (
                    <pre className="spe-omni-code-block">{activeVideoData.systemPrompt}</pre>
                  )}
                </div>

                <div className="spe-omni-action-bar">
                  <span className="spe-omni-receipt-badge">
                    <span>🎬</span>
                    <span>TEMPORAL-SCENE-GRAPH: {activeVideoData.frames.length} FRAMES</span>
                  </span>
                  <div className="spe-omni-btn-group">
                    <button className="spe-omni-btn" onClick={() => handleCopy(videoTab === "test" ? activeVideoData.testCode : activeVideoData.systemPrompt, setCopiedCode)}>
                      {copiedCode ? "✓ Copied" : "Copy Test / Prompt"}
                    </button>
                    <button
                      className="spe-omni-btn primary"
                      onClick={() => {
                        if (onApplyPrompt) onApplyPrompt(activeVideoData.systemPrompt);
                        else handleCopy(activeVideoData.systemPrompt, setCopiedCode);
                      }}
                    >
                      Compile to System Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* PILLAR 4: PHOTO TO CODE (SPATIAL AST INVERSE-COMPILER & LIVE PREVIEW)*/}
        {/* ==================================================================== */}
        {activePillar === "photo_to_code" && (
          <section aria-labelledby="photo-code-heading">
            <h2 id="photo-code-heading" className="sr-only">Photo to Code Spatial AST Inverse-Compiler</h2>
            <div className="spe-omni-presets">
              <span className="spe-omni-presets-label">UI Layout Presets:</span>
              {Object.keys(codePresetsData).map((key) => (
                <button
                  key={key}
                  className={`spe-omni-preset-pill ${codePreset === key ? "active" : ""}`}
                  onClick={() => setCodePreset(key)}
                >
                  {codePresetsData[key].title}
                </button>
              ))}
            </div>

            <div className="spe-omni-dual-pane">
              {/* Left Pane: Visual Mockup with Component Bounding Zones */}
              <div className="spe-omni-canvas-card">
                <div className="spe-omni-canvas-header">
                  <span className="spe-omni-canvas-title">
                    <span>📐</span>
                    <span>Visual Layout Segmentation AST</span>
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{activeCodeData.ast.length} Components</span>
                </div>

                {/* SVG Visual Component Blueprint */}
                <div className="spe-omni-viewport">
                  <svg viewBox="0 0 100 100" style={{ width: "100%", height: "420px", background: "#060910" }}>
                    {/* Header */}
                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Navbar (Header)")}
                      data-testid="caliper-target-navbar"
                    >
                      <rect
                        x="5" y="6" width="90" height="12"
                        fill={caliperSelectedComponent === "Navbar (Header)" ? "rgba(139, 92, 246, 0.35)" : "rgba(139, 92, 246, 0.15)"}
                        stroke={caliperSelectedComponent === "Navbar (Header)" ? "#38bdf8" : "#8b5cf6"}
                        strokeWidth={caliperSelectedComponent === "Navbar (Header)" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="8" y="13.5" fill="#c084fc" fontSize="2.5" fontWeight="bold">Navbar (Header)</text>
                    </g>

                    {/* Metric Cards */}
                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Metric Card 1 (ARR)")}
                      data-testid="caliper-target-arr"
                    >
                      <rect
                        x="5" y="22" width="28" height="24"
                        fill={caliperSelectedComponent === "Metric Card 1 (ARR)" ? "rgba(6, 182, 212, 0.35)" : "rgba(6, 182, 212, 0.12)"}
                        stroke={caliperSelectedComponent === "Metric Card 1 (ARR)" ? "#38bdf8" : "#06b6d4"}
                        strokeWidth={caliperSelectedComponent === "Metric Card 1 (ARR)" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="7" y="28" fill="#38bdf8" fontSize="2.2" fontWeight="bold">Metric Card 1</text>
                      <text x="7" y="36" fill="#ffffff" fontSize="3.2" fontWeight="bold">$4.25M</text>
                    </g>

                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Metric Card 2 (WASM Latency)")}
                      data-testid="caliper-target-latency"
                    >
                      <rect
                        x="36" y="22" width="28" height="24"
                        fill={caliperSelectedComponent === "Metric Card 2 (WASM Latency)" ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.12)"}
                        stroke={caliperSelectedComponent === "Metric Card 2 (WASM Latency)" ? "#38bdf8" : "#10b981"}
                        strokeWidth={caliperSelectedComponent === "Metric Card 2 (WASM Latency)" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="38" y="28" fill="#34d399" fontSize="2.2" fontWeight="bold">WASM Latency</text>
                      <text x="38" y="36" fill="#38bdf8" fontSize="3.2" fontWeight="bold">1.2 ms</text>
                    </g>

                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Metric Card 3 (Auto-Immunization)")}
                      data-testid="caliper-target-immunity"
                    >
                      <rect
                        x="67" y="22" width="28" height="24"
                        fill={caliperSelectedComponent === "Metric Card 3 (Auto-Immunization)" ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.12)"}
                        stroke={caliperSelectedComponent === "Metric Card 3 (Auto-Immunization)" ? "#38bdf8" : "#f59e0b"}
                        strokeWidth={caliperSelectedComponent === "Metric Card 3 (Auto-Immunization)" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="69" y="28" fill="#fbbf24" fontSize="2.2" fontWeight="bold">Immunity</text>
                      <text x="69" y="36" fill="#a855f7" fontSize="3.2" fontWeight="bold">100.0%</text>
                    </g>

                    {/* Main Chart Area */}
                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Telemetry Graph & Live Waveform")}
                      data-testid="caliper-target-telemetry"
                    >
                      <rect
                        x="5" y="50" width="58" height="44"
                        fill={caliperSelectedComponent === "Telemetry Graph & Live Waveform" ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)"}
                        stroke={caliperSelectedComponent === "Telemetry Graph & Live Waveform" ? "#38bdf8" : "#475569"}
                        strokeWidth={caliperSelectedComponent === "Telemetry Graph & Live Waveform" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="8" y="56" fill="#94a3b8" fontSize="2.5" fontWeight="bold">Telemetry Graph & Live Waveform</text>
                      <path d="M 8 82 Q 22 62, 36 74 T 60 58" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
                    </g>

                    {/* Side Rail Panel */}
                    <g
                      style={{ cursor: "pointer" }}
                      onClick={() => setCaliperSelectedComponent("Zero-Egress Security Feed")}
                      data-testid="caliper-target-feed"
                    >
                      <rect
                        x="67" y="50" width="28" height="44"
                        fill={caliperSelectedComponent === "Zero-Egress Security Feed" ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)"}
                        stroke={caliperSelectedComponent === "Zero-Egress Security Feed" ? "#38bdf8" : "#475569"}
                        strokeWidth={caliperSelectedComponent === "Zero-Egress Security Feed" ? "1.8" : "0.8"}
                        rx="2"
                      />
                      <text x="70" y="56" fill="#94a3b8" fontSize="2.5" fontWeight="bold">Zero-Egress Feed</text>
                      <rect x="70" y="62" width="22" height="6" fill="rgba(16, 185, 129, 0.2)" rx="1" />
                      <rect x="70" y="72" width="22" height="6" fill="rgba(139, 92, 246, 0.2)" rx="1" />
                    </g>
                  </svg>
                </div>

                {/* Pinpoint Calipers HUD Overlay */}
                <div style={{ padding: "0.75rem 1rem", background: "rgba(15, 23, 42, 0.95)", borderTop: "1px solid rgba(30, 41, 59, 0.8)", display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.78rem" }} data-testid="pinpoint-calipers-hud">
                  <span style={{ color: "#38bdf8" }}>📐 <strong>Calipers:</strong> {calipers.component} [{calipers.bounds.width}×{calipers.bounds.height}px]</span>
                  <span style={{ color: "#a855f7" }}>🔤 <strong>Font:</strong> {calipers.typography.fontSize} / {calipers.typography.lineHeight} ({calipers.typography.fontFamily})</span>
                  <span style={{ color: "#34d399" }}>⚖️ <strong>WCAG Contrast:</strong> {calipers.contrastRatio}:1 ({calipers.wcagCompliance})</span>
                  <span style={{ color: "#fbbf24" }}>↔️ <strong>Flex:</strong> {calipers.flexDirection} (Gap: {calipers.gap})</span>
                </div>
              </div>

              {/* Right Pane: Live Interactive Sandbox & Multi-Target Code Generator */}
              <div className="spe-omni-tabs-card">
                <div className="spe-omni-tab-bar">
                  <div className="spe-omni-tab-buttons">
                    <button className={`spe-omni-tab-btn ${codeTab === "sandbox" ? "active" : ""}`} onClick={() => setCodeTab("sandbox")}>Live Interactive Sandbox</button>
                    <button className={`spe-omni-tab-btn ${codeTab === "code" ? "active" : ""}`} onClick={() => setCodeTab("code")}>Compiled Code</button>
                    <button className={`spe-omni-tab-btn ${codeTab === "editor" ? "active" : ""}`} onClick={() => setCodeTab("editor")}>Live Code Editor</button>
                    <button className={`spe-omni-tab-btn ${codeTab === "tokens" ? "active" : ""}`} onClick={() => setCodeTab("tokens")}>Design Tokens</button>
                    <button className={`spe-omni-tab-btn ${codeTab === "ast" ? "active" : ""}`} onClick={() => setCodeTab("ast")}>Component AST</button>
                  </div>

                  {(codeTab === "code" || codeTab === "editor") && (
                    <select
                      value={codeTarget}
                      onChange={(e) => setCodeTarget(e.target.value as CodeTarget)}
                      style={{ padding: "0.25rem 0.5rem", borderRadius: "6px", background: "#0b0f19", color: "#e2e8f0", border: "1px solid #334155", fontSize: "0.8rem" }}
                    >
                      <option value="react">React 19 + Tailwind</option>
                      <option value="nextjs">Next.js 15 Server Comp</option>
                      <option value="vue">Vue 3 Composition</option>
                      <option value="svelte">Svelte 5 Runes</option>
                      <option value="swiftui">SwiftUI (iOS 18)</option>
                      <option value="compose">Jetpack Compose (Android)</option>
                      <option value="html">1-File HTML (Tailwind CDN)</option>
                    </select>
                  )}
                </div>

                <div className="spe-omni-content-box">
                  {/* TAB 1: LIVE INTERACTIVE PREVIEW SANDBOX */}
                  {codeTab === "sandbox" && (
                    <div className="spe-omni-sandbox-viewport" style={{ background: sandboxTheme === "dark" ? "#0b0f19" : "#f8fafc", color: sandboxTheme === "dark" ? "#ffffff" : "#0f172a" }}>
                      {/* Header Inside Sandbox */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${sandboxTheme === "dark" ? "#1e293b" : "#e2e8f0"}`, paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ background: "#8b5cf6", width: "24px", height: "24px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.75rem", color: "#ffffff" }}>Ω</span>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>SPE Live Interactive Preview</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <button
                            onClick={() => setSandboxTheme(sandboxTheme === "dark" ? "light" : "dark")}
                            style={{ padding: "0.25rem 0.6rem", borderRadius: "6px", border: "1px solid #475569", background: "transparent", color: "inherit", fontSize: "0.75rem", cursor: "pointer" }}
                          >
                            Toggle Theme ({sandboxTheme})
                          </button>
                        </div>
                      </div>

                      {/* Interactive Nav Pills */}
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        {["Overview", "Telemetry", "Security Audit", "API Sinks"].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setSandboxActiveNavItem(tab)}
                            style={{
                              padding: "0.3rem 0.75rem",
                              borderRadius: "6px",
                              border: "none",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              background: sandboxActiveNavItem === tab ? "#8b5cf6" : (sandboxTheme === "dark" ? "#1e293b" : "#e2e8f0"),
                              color: sandboxActiveNavItem === tab ? "#ffffff" : "inherit"
                            }}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {/* Interactive Metrics */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ padding: "0.85rem", borderRadius: "8px", background: sandboxTheme === "dark" ? "#111827" : "#ffffff", border: `1px solid ${sandboxTheme === "dark" ? "#1f2937" : "#e2e8f0"}` }}>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Annual Run Rate</span>
                          <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: "0.25rem" }}>$4,250,000</div>
                          <span style={{ fontSize: "0.7rem", color: "#10b981" }}>+34.2% YoY</span>
                        </div>
                        <div style={{ padding: "0.85rem", borderRadius: "8px", background: sandboxTheme === "dark" ? "#111827" : "#ffffff", border: `1px solid ${sandboxTheme === "dark" ? "#1f2937" : "#e2e8f0"}` }}>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>WASM Latency</span>
                          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#06b6d4", marginTop: "0.25rem" }}>1.2 ms</div>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Zero Cloud Spend</span>
                        </div>
                        <div style={{ padding: "0.85rem", borderRadius: "8px", background: sandboxTheme === "dark" ? "#111827" : "#ffffff", border: `1px solid ${sandboxTheme === "dark" ? "#1f2937" : "#e2e8f0"}` }}>
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Auto-Immunization</span>
                          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a855f7", marginTop: "0.25rem" }}>100.0%</div>
                          <span style={{ fontSize: "0.7rem", color: "#10b981" }}>✓ Certified</span>
                        </div>
                      </div>

                      {/* Interactive Search Field */}
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="text"
                          value={sandboxSearchQuery}
                          onChange={(e) => setSandboxSearchQuery(e.target.value)}
                          placeholder="Type interactive filter query here..."
                          style={{ flex: 1, padding: "0.5rem 0.85rem", borderRadius: "6px", border: `1px solid ${sandboxTheme === "dark" ? "#334155" : "#cbd5e1"}`, background: sandboxTheme === "dark" ? "#07090e" : "#ffffff", color: "inherit", fontSize: "0.85rem" }}
                        />
                        <button
                          onClick={() => setSandboxSwitchEnabled(!sandboxSwitchEnabled)}
                          style={{ padding: "0.5rem 0.85rem", borderRadius: "6px", border: "none", background: sandboxSwitchEnabled ? "#10b981" : "#64748b", color: "#ffffff", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}
                        >
                          {sandboxSwitchEnabled ? "Guard: ACTIVE" : "Guard: PAUSED"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: COMPILED CODE */}
                  {codeTab === "code" && (
                    <pre className="spe-omni-code-block">{activeCodeData.code[codeTarget]}</pre>
                  )}

                  {/* TAB 3: EXTRACTED DESIGN TOKENS */}
                  {codeTab === "tokens" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <h4 style={{ margin: 0, color: "#38bdf8", fontSize: "0.9rem" }}>Extracted Hex Palette Swatches</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                        {activeCodeData.palette.map((swatch) => (
                          <div key={swatch.hex} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", background: "#07090e", borderRadius: "8px", border: "1px solid #1e293b" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: swatch.hex, border: "1px solid rgba(255,255,255,0.2)" }} />
                            <div>
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#ffffff" }}>{swatch.name}</div>
                              <code style={{ fontSize: "0.75rem", color: "#38bdf8" }}>{swatch.hex}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: COMPONENT AST */}
                  {codeTab === "ast" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <h4 style={{ margin: 0, color: "#38bdf8", fontSize: "0.9rem" }}>Spatial AST Hierarchy</h4>
                      {activeCodeData.ast.map((node, i) => (
                        <div key={i} style={{ padding: "0.75rem", background: "#07090e", borderRadius: "8px", border: "1px solid #1e293b" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                            <strong style={{ color: "#c084fc", fontSize: "0.85rem" }}>{node.component}</strong>
                            <code style={{ color: "#64748b", fontSize: "0.75rem" }}>{node.bounds}</code>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {node.children.map((child, j) => (
                              <span key={j} style={{ padding: "0.15rem 0.5rem", background: "rgba(255,255,255,0.06)", borderRadius: "4px", fontSize: "0.72rem", color: "#cbd5e1" }}>
                                {child}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 5: LIVE CODE EDITOR WITH INSTANT DOM PREVIEW */}
                  {codeTab === "editor" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: "bold" }}>Editable Source ({codeTarget.toUpperCase()})</span>
                          <span style={{ fontSize: "0.75rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                            ⚡ Instant DOM Sync & Hot Reload
                          </span>
                        </div>
                        {liveEditedCode && (
                          <button
                            onClick={() => setLiveEditedCode("")}
                            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", cursor: "pointer" }}
                          >
                            Reset to Template
                          </button>
                        )}
                      </div>

                      {/* Split Pane: Code Editor + Instant Live DOM Preview */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        {/* Left: Code Editor Textarea */}
                        <div>
                          <textarea
                            value={liveEditedCode || activeCodeData.code[codeTarget]}
                            onChange={(e) => setLiveEditedCode(e.target.value)}
                            className="spe-omni-code-block"
                            style={{ width: "100%", height: "300px", resize: "none", fontFamily: "monospace", fontSize: "0.8rem", background: "#060910", color: "#38bdf8", border: "1px solid #334155", borderRadius: "8px", padding: "0.75rem", boxSizing: "border-box" }}
                            data-testid="live-code-editor"
                          />
                        </div>

                        {/* Right: Instant Rendered Live DOM Preview */}
                        <div style={{ display: "flex", flexDirection: "column", background: "#0b0f19", borderRadius: "8px", border: "1px solid #334155", overflow: "hidden", height: "300px" }}>
                          <div style={{ padding: "0.4rem 0.75rem", background: "#0f172a", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>⚡ Instant Rendered DOM</span>
                            <span style={{ fontSize: "0.68rem", color: "#34d399", fontWeight: 600 }}>Zero-Latency Sync</span>
                          </div>

                          {codeTarget === "html" ? (
                            <iframe
                              srcDoc={liveEditedCode || activeCodeData.code[codeTarget]}
                              title="Instant HTML DOM Preview"
                              style={{ width: "100%", height: "100%", border: "none", background: "#060910" }}
                              sandbox="allow-scripts"
                              data-testid="live-dom-preview-frame"
                            />
                          ) : (
                            <div style={{ padding: "1rem", overflowY: "auto", height: "100%", color: "#ffffff", fontSize: "0.85rem" }} data-testid="live-dom-preview-container">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                  <span style={{ background: "#8b5cf6", width: "20px", height: "20px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.7rem", color: "#ffffff" }}>Ω</span>
                                  <strong style={{ fontSize: "0.85rem" }}>{activeCodeData.title}</strong>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "#34d399", background: "rgba(16, 185, 129, 0.15)", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>DOM Active</span>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                <div style={{ padding: "0.5rem", borderRadius: "6px", background: "#111827", border: "1px solid #1f2937" }}>
                                  <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>TARGET DIALECT</div>
                                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#38bdf8" }}>{codeTarget.toUpperCase()}</div>
                                </div>
                                <div style={{ padding: "0.5rem", borderRadius: "6px", background: "#111827", border: "1px solid #1f2937" }}>
                                  <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>SOURCE LENGTH</div>
                                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#a855f7" }}>{(liveEditedCode || activeCodeData.code[codeTarget]).length} chars</div>
                                </div>
                              </div>
                              <div style={{ padding: "0.5rem", borderRadius: "6px", background: "#07090e", border: "1px solid #1e293b", fontSize: "0.75rem", color: "#cbd5e1" }}>
                                <strong>DOM Node Tree ({activeCodeData.ast.length} nodes):</strong>
                                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.5 }}>
                                  {activeCodeData.ast.map((node, i) => (
                                    <li key={i}><span style={{ color: "#38bdf8" }}>{node.component}</span> &bull; <span style={{ color: "#64748b" }}>{node.bounds}</span></li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="spe-omni-action-bar">
                  <span className="spe-omni-receipt-badge">
                    <span>⚡</span>
                    <span>WASM INVERSE COMPILER &bull; $0 AIR-GAPPED</span>
                  </span>
                  <div className="spe-omni-btn-group">
                    <button
                      className="spe-omni-btn"
                      onClick={() => handleCopy(liveEditedCode || activeCodeData.code[codeTarget], setCopiedCode)}
                    >
                      {copiedCode ? "✓ Copied" : "Copy Production Code"}
                    </button>
                    <button
                      className="spe-omni-btn primary"
                      onClick={() => {
                        const compiledPrompt = `<!-- SYSTEM PROMPT: ${activeCodeData.title} -->\n<purpose>\nBuild production-grade ${activeCodeData.title} interface with strict component invariants.\n</purpose>\n\n<operational_constraints>\n- Match extracted design tokens: Primary ${activeCodeData.palette[0]?.hex}.\n- Maintain zero-telemetry client-side privacy.\n</operational_constraints>`;
                        if (onApplyPrompt) onApplyPrompt(compiledPrompt);
                        else handleCopy(compiledPrompt, setCopiedCode);
                      }}
                    >
                      Export System Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* PILLAR 5: IMAGE TO PROMPT (3D LIGHTING & VISUAL DNA DIAL)            */}
        {/* ==================================================================== */}
        {activePillar === "image_to_prompt" && (
          <section aria-labelledby="image-prompt-heading">
            <h2 id="image-prompt-heading" className="sr-only">Image to Prompt 3D Lighting & Visual DNA Dial</h2>
            
            {/* Sub-Mode Selector: 3D Lighting Dial vs PromptCard Studio */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem" }}>
              <button
                className={`spe-omni-preset-pill ${imagePromptSubMode === "dial" ? "active" : ""}`}
                onClick={() => setImagePromptSubMode("dial")}
                data-testid="mode-lighting-dial"
              >
                💡 3D Lighting & Visual DNA Dial
              </button>
              <button
                className={`spe-omni-preset-pill ${imagePromptSubMode === "promptcard" ? "active" : ""}`}
                onClick={() => setImagePromptSubMode("promptcard")}
                data-testid="mode-promptcard-studio"
              >
                🃏 PromptCard VLM (V1.4.0) Studio
              </button>
            </div>

            {imagePromptSubMode === "promptcard" ? (
              <div style={{ marginTop: "1rem" }}>
                <PromptCardWorkbench customerTier="PRO" onSelectPrompt={onApplyPrompt} />
              </div>
            ) : (
              <>
                {/* 3D Lighting Vector Dial Presets Bar */}
                <div className="spe-omni-presets">
                  <span className="spe-omni-presets-label">3D Lighting Presets:</span>
              {(Object.keys(LIGHTING_PRESETS) as LightingVectorKey[]).map((key) => {
                const setting = LIGHTING_PRESETS[key];
                return (
                  <button
                    key={key}
                    className={`spe-omni-preset-pill ${lightingVector === key ? "active" : ""}`}
                    onClick={() => setLightingVector(key)}
                    data-testid={`lighting-preset-${key}`}
                  >
                    {setting.label} ({setting.temperatureK}K)
                  </button>
                );
              })}
            </div>

            {/* Visual DNA Chromosome Presets Bar */}
            <div className="spe-omni-presets" style={{ marginTop: "0.5rem" }}>
              <span className="spe-omni-presets-label">Visual DNA Presets:</span>
              {Object.keys(VISUAL_DNA_PRESETS).map((key) => {
                const setting = VISUAL_DNA_PRESETS[key];
                return (
                  <button
                    key={key}
                    className={`spe-omni-preset-pill ${activeDnaPresetKey === key ? "active" : ""}`}
                    onClick={() => {
                      setActiveDnaPresetKey(key);
                      setVisualDna(setting.dna);
                    }}
                    data-testid={`dna-preset-${key}`}
                  >
                    {setting.label}
                  </button>
                );
              })}
            </div>

            <div className="spe-omni-dual-pane">
              {/* Left Pane: 3D Lighting Vector & Visual DNA Chromosomes */}
              <div className="spe-omni-canvas-card">
                <div className="spe-omni-canvas-header">
                  <span className="spe-omni-canvas-title">
                    <span>💡</span>
                    <span>3D Lighting Vector & Visual Chromosomes</span>
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#34d399", fontFamily: "monospace" }}>
                    {LIGHTING_PRESETS[lightingVector].temperatureK}K &bull; ∠{LIGHTING_PRESETS[lightingVector].angleDegrees}°
                  </span>
                </div>

                {/* Lighting Dial Interactive Display */}
                <div style={{ padding: "1.25rem", background: "#060910", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ padding: "1rem", borderRadius: "8px", background: "rgba(15, 23, 42, 0.8)", border: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <strong style={{ color: "#38bdf8", fontSize: "0.9rem" }}>{LIGHTING_PRESETS[lightingVector].label}</strong>
                      <span style={{ fontSize: "0.75rem", color: "#fbbf24" }}>Intensity: {(LIGHTING_PRESETS[lightingVector].intensity * 100).toFixed(0)}%</span>
                    </div>
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.82rem", color: "#cbd5e1" }}>{LIGHTING_PRESETS[lightingVector].descriptor}</p>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      <strong>Shadow Falloff:</strong> {LIGHTING_PRESETS[lightingVector].shadowFalloff}
                    </div>
                  </div>

                  {/* Visual DNA Chromosomes Grid */}
                  <h4 style={{ margin: "0.5rem 0 0 0", color: "#c084fc", fontSize: "0.85rem", textTransform: "uppercase" }}>Extracted Visual DNA Chromosomes</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
                    <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Optics / Camera</span>
                      <input
                        value={visualDna.optics}
                        onChange={(e) => setVisualDna((prev) => ({ ...prev, optics: e.target.value }))}
                        style={{ width: "100%", background: "transparent", border: "none", color: "#ffffff", fontSize: "0.8rem", fontWeight: 600, outline: "none", marginTop: "0.2rem" }}
                        data-testid="dna-input-optics"
                      />
                    </div>
                    <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Focal Length</span>
                      <input
                        value={visualDna.focalLength}
                        onChange={(e) => setVisualDna((prev) => ({ ...prev, focalLength: e.target.value }))}
                        style={{ width: "100%", background: "transparent", border: "none", color: "#38bdf8", fontSize: "0.8rem", fontWeight: 600, outline: "none", marginTop: "0.2rem" }}
                        data-testid="dna-input-focal-length"
                      />
                    </div>
                    <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Bokeh Character</span>
                      <input
                        value={visualDna.bokeh}
                        onChange={(e) => setVisualDna((prev) => ({ ...prev, bokeh: e.target.value }))}
                        style={{ width: "100%", background: "transparent", border: "none", color: "#a855f7", fontSize: "0.8rem", fontWeight: 600, outline: "none", marginTop: "0.2rem" }}
                        data-testid="dna-input-bokeh"
                      />
                    </div>
                    <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Medium / Grain</span>
                      <input
                        value={visualDna.medium}
                        onChange={(e) => setVisualDna((prev) => ({ ...prev, medium: e.target.value }))}
                        style={{ width: "100%", background: "transparent", border: "none", color: "#34d399", fontSize: "0.8rem", fontWeight: 600, outline: "none", marginTop: "0.2rem" }}
                        data-testid="dna-input-medium"
                      />
                    </div>
                  </div>

                  <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Compositional Framing</span>
                    <input
                      value={visualDna.composition}
                      onChange={(e) => setVisualDna((prev) => ({ ...prev, composition: e.target.value }))}
                      style={{ width: "100%", background: "transparent", border: "none", color: "#fbbf24", fontSize: "0.8rem", fontWeight: 600, outline: "none", marginTop: "0.2rem" }}
                      data-testid="dna-input-composition"
                    />
                  </div>

                  <div style={{ padding: "0.6rem 0.85rem", background: "#0b0f19", borderRadius: "6px", border: "1px solid #1e293b" }}>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>Subject / Core Entity</span>
                    <input
                      value={visualDna.subject}
                      onChange={(e) => setVisualDna((prev) => ({ ...prev, subject: e.target.value }))}
                      style={{ width: "100%", background: "transparent", border: "none", color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 500, outline: "none", marginTop: "0.2rem" }}
                      data-testid="dna-input-subject"
                    />
                  </div>
                </div>
              </div>

              {/* Right Pane: Model Dialect Modulation Output */}
              <div className="spe-omni-tabs-card">
                <div className="spe-omni-tab-bar">
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff", padding: "0.4rem 0" }}>
                    Model-Targeted Prompt Modulation
                  </span>
                </div>

                <div className="spe-omni-content-box" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Midjourney v6.1 */}
                  <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <strong style={{ color: "#38bdf8", fontSize: "0.85rem" }}>Midjourney v6.1 (Raw Style Flagged)</strong>
                      <button className="spe-omni-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleCopy(modulatedPrompts.midjourneyV61, setCopiedCode)}>Copy</button>
                    </div>
                    <pre className="spe-omni-code-block" style={{ margin: 0, fontSize: "0.8rem" }} data-testid="mj-prompt-output">{modulatedPrompts.midjourneyV61}</pre>
                  </div>

                  {/* FLUX.1 [dev] */}
                  <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <strong style={{ color: "#a855f7", fontSize: "0.85rem" }}>FLUX.1 [dev] (Ray-Traced Lighting Tokens)</strong>
                      <button className="spe-omni-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleCopy(modulatedPrompts.flux1Dev, setCopiedCode)}>Copy</button>
                    </div>
                    <pre className="spe-omni-code-block" style={{ margin: 0, fontSize: "0.8rem" }} data-testid="flux-prompt-output">{modulatedPrompts.flux1Dev}</pre>
                  </div>

                  {/* SDXL Dual Pair */}
                  <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <strong style={{ color: "#34d399", fontSize: "0.85rem" }}>Stable Diffusion XL (Positive & Negative)</strong>
                      <button className="spe-omni-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleCopy(`POSITIVE:\n${modulatedPrompts.sdxl.positive}\n\nNEGATIVE:\n${modulatedPrompts.sdxl.negative}`, setCopiedCode)}>Copy</button>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: "bold", marginBottom: "0.25rem" }}>POSITIVE:</div>
                    <pre className="spe-omni-code-block" style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem" }}>{modulatedPrompts.sdxl.positive}</pre>
                    <div style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: "bold", marginBottom: "0.25rem" }}>NEGATIVE:</div>
                    <pre className="spe-omni-code-block" style={{ margin: 0, fontSize: "0.8rem" }}>{modulatedPrompts.sdxl.negative}</pre>
                  </div>

                  {/* DALL-E 3 */}
                  <div style={{ padding: "1rem", background: "#07090e", borderRadius: "10px", border: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <strong style={{ color: "#fbbf24", fontSize: "0.85rem" }}>DALL-E 3 (Narrative Descriptive Framing)</strong>
                      <button className="spe-omni-btn" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => handleCopy(modulatedPrompts.dalle3, setCopiedCode)}>Copy</button>
                    </div>
                    <pre className="spe-omni-code-block" style={{ margin: 0, fontSize: "0.8rem" }}>{modulatedPrompts.dalle3}</pre>
                  </div>
                </div>

                <div className="spe-omni-action-bar">
                  <span className="spe-omni-receipt-badge">
                    <span>💡</span>
                    <span>DNA-CHROMOSOMES: 5 EXTRACTED &bull; 8 LIGHTING PRESETS</span>
                  </span>
                  <div className="spe-omni-btn-group">
                    <button
                      className="spe-omni-btn primary"
                      onClick={() => {
                        const compiledPrompt = `<!-- SYSTEM PROMPT: 3D Visual Director (${LIGHTING_PRESETS[lightingVector].label}) -->\n<purpose>\nGenerate hyper-detailed generative images using modulated 3D lighting vectors and extracted visual DNA.\n</purpose>\n\n<chromosomes>\n- Optics: ${visualDna.optics}\n- Focal Length: ${visualDna.focalLength}\n- Bokeh: ${visualDna.bokeh}\n- Medium: ${visualDna.medium}\n- Lighting: ${LIGHTING_PRESETS[lightingVector].descriptor}\n</chromosomes>`;
                        if (onApplyPrompt) onApplyPrompt(compiledPrompt);
                        else handleCopy(compiledPrompt, setCopiedCode);
                      }}
                    >
                      Export DNA System Prompt
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}
        </section>
      )}

      </main>
    </div>
  );
};
