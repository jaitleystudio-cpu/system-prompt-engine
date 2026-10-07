#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("⚡ [Test Phase 3] Building and benchmarking In-WASM Supersonic Hybrid RAG Retrieval Fabric...");

// Build bundle for hybridRagEngine.ts
const bundle = await build({
  entryPoints: [join(root, "src/engine/hybridRagEngine.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const rag = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 1. Verify Default Canonical Knowledge Base
const defaultEngine = rag.defaultRagEngine;
const stats = defaultEngine.getStats();
assert.ok(stats.totalDocuments >= 10, "Default engine should contain preloaded standards");
assert.equal(stats.embeddingDimension, 384, "Must use 384-dimensional dense vectors");
console.log(`✓ Preloaded knowledge base indexed: ${stats.totalDocuments} standards, vocab size: ${stats.sparseVocabularySize}`);

// 2. Test BM25 Sparse Search
const sparseResults = defaultEngine.searchSparse("OWASP input sanitization delimiters", 3);
assert.ok(sparseResults.length > 0, "Sparse search should return results");
assert.ok(sparseResults[0].score > 0, "Top sparse result should have positive score");
console.log(`✓ BM25 sparse search returned ${sparseResults.length} matches (Top score: ${sparseResults[0].score.toFixed(2)})`);

// 3. Test Dense 384-d Vector Semantic Search
const denseResults = defaultEngine.searchDense("memory isolation and cognitive architecture", 3);
assert.ok(denseResults.length > 0, "Dense search should return results");
assert.ok(denseResults[0].score > 0, "Top dense similarity should be positive");
console.log(`✓ Dense 384-d semantic search returned ${denseResults.length} matches (Top cosine: ${denseResults[0].score.toFixed(3)})`);

// 4. Test Reciprocal Rank Fusion (RRF)
const hybridResults = defaultEngine.searchHybrid("clean architecture boundary contracts", 3);
assert.ok(hybridResults.length > 0, "Hybrid RRF should return results");
assert.ok(hybridResults[0].rrfScore > 0, "RRF score must be positive");
assert.ok(hybridResults[0].doc.title.length > 0, "Result document must have title");
console.log(`✓ Hybrid RRF fused top result: "${hybridResults[0].doc.title}" (RRF: ${hybridResults[0].rrfScore})`);

// 5. Stress Benchmark: Index 5,000 synthetic technical documents
console.log("\n⚡ Ingesting 5,000 synthetic technical corpus documents into Hybrid RAG Fabric...");
const benchEngine = new rag.HybridRagEngine([]);
const categories = ["security", "architecture", "invariant", "performance", "testing"];
const corpus = [];
for (let i = 0; i < 5000; i++) {
  corpus.push({
    id: `DOC-BENCH-${i}`,
    title: `Microservice Standard ${i}: Distributed Consensus and Paxos Layer`,
    category: categories[i % categories.length],
    content: `Document ${i} specifies architectural guidelines for node replication, raft state machine logging, network partitions, and cryptographic attestation hashing for distributed cluster ${i % 50}.`,
  });
}

const indexStart = Date.now();
benchEngine.addDocuments(corpus);
const indexElapsed = Date.now() - indexStart;
console.log(`✓ 5,000 documents indexed into Sparse Inverted Index + 384-d Dense Index in ${indexElapsed}ms.`);

// 6. Benchmark Retrieval Latency across 100 queries on 5,000 documents
const queryStart = Date.now();
const queryCount = 100;
for (let q = 0; q < queryCount; q++) {
  const query = `cryptographic attestation hashing cluster ${q % 50}`;
  const res = benchEngine.searchHybrid(query, 5);
  assert.ok(res.length > 0, "Must find relevant documents");
}
const totalQueryMs = Date.now() - queryStart;
const avgLatencyMs = totalQueryMs / queryCount;
console.log(`✓ Executed ${queryCount} hybrid RAG searches in ${totalQueryMs}ms (Average Latency: ${avgLatencyMs.toFixed(3)}ms per query).`);
assert.ok(avgLatencyMs < 5.0, `Average query latency must be sub-5ms across 5,000 documents, got ${avgLatencyMs.toFixed(3)}ms`);

// 7. Test Grounded Knowledge Anchor Section Generation
const anchorSection = defaultEngine.generateKnowledgeAnchorSection("Design a secure API gateway with zero trust", 2);
assert.ok(anchorSection.includes("# Grounded Knowledge Anchors & Architectural Context"), "Must contain anchor header");
assert.ok(anchorSection.includes("OWASP") || anchorSection.includes("Clean Architecture") || anchorSection.includes("Standard:"), "Must inject retrieved standards");
console.log("✓ Knowledge anchor block generated successfully for prompt injection.");

console.log("✅ Phase 3: In-WASM Supersonic Hybrid RAG Retrieval Fabric PASSED!");
