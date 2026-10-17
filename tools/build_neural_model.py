#!/usr/bin/env python3
"""
SPE Ω — Core A Neural Research Fixture Builder

EXPERIMENTAL RESEARCH FIXTURE DISCLOSURE:
This script builds an experimental 593 KB ONNX prototype for validating local in-browser
WASM tensor execution and autoregressive token generation.
The weights are initialized with random numbers and configured token transitions.
It is an experimental computational fixture, NOT a general language model trained
on a text corpus with learned language competence.
Target: apps/web/public/models/spe-core-a-neural-generator-v1.onnx
"""

import os
import hashlib
import numpy as np
import onnx
from onnx import helper, TensorProto

VOCAB_SIZE = 320
HIDDEN_DIM = 128
INTERMEDIATE_DIM = 256

EOS = 256
PROMPT_END = 257
ROLE_HDR = 258
OBJ_HDR = 259
CONST_HDR = 260
APPROACH_HDR = 261
MISSING_HDR = 262
DELIV_HDR = 263
CHECKS_HDR = 264

ROLE_BODY = 265
OBJ_BODY = 266
APPROACH_BODY = 267
MISSING_BODY = 268
DELIV_BODY = 269
CHECKS_BODY = 270
T_DETERMINISTIC = 271

# Domain tokens:
# Domain 1 (Rust): 272 -> 273 -> 274 -> APPROACH_HDR
# Domain 2 (Android): 275 -> 276 -> 277 -> APPROACH_HDR
# Domain 3 (WebGL): 278 -> 279 -> APPROACH_HDR
# Domain 4 (Python): 280 -> 281 -> 282 -> APPROACH_HDR
# Domain 5 (SQLite): 283 -> 284 -> APPROACH_HDR
# Domain 6 (SwiftUI): 285 -> 286 -> 287 -> APPROACH_HDR
# Domain 7 (TypeScript): 288 -> 289 -> 290 -> APPROACH_HDR
# Domain 8 (C++): 291 -> 292 -> APPROACH_HDR
# Domain 9 (Drift): 293 -> 294 -> 295 -> APPROACH_HDR
# Domain 10 (WASM): 296 -> 297 -> APPROACH_HDR
# Default: 298 -> 299 -> APPROACH_HDR

chains = [
    (0, [272, 273, 274]),
    (1, [275, 276, 277]),
    (2, [278, 279]),
    (3, [280, 281, 282]),
    (4, [283, 284]),
    (5, [285, 286, 287]),
    (6, [288, 289, 290]),
    (7, [291, 292]),
    (8, [293, 294, 295]),
    (9, [296, 297]),
]

def build_model():
    np.random.seed(1337)

    emb = (np.random.randn(VOCAB_SIZE, HIDDEN_DIM) * 0.001).astype(np.float32)
    w1 = (np.random.randn(HIDDEN_DIM, INTERMEDIATE_DIM) * 0.001).astype(np.float32)
    b1 = np.zeros(INTERMEDIATE_DIM, dtype=np.float32)
    w2 = (np.random.randn(INTERMEDIATE_DIM, HIDDEN_DIM) * 0.001).astype(np.float32)
    b2 = np.zeros(HIDDEN_DIM, dtype=np.float32)
    w_head = (np.random.randn(HIDDEN_DIM, VOCAB_SIZE) * 0.001).astype(np.float32)
    b_head = np.zeros(VOCAB_SIZE, dtype=np.float32)

    # Prompt keyword mapping (tokens 302..311)
    for i in range(10):
        tok = 302 + i
        emb[tok, i] = 50.0

    def add_trans(src, dst, weight=60.0):
        dim = 50 + (src - 256)
        emb[src, dim] = 4.0
        w_head[dim, dst] = weight

    # Preamble transitions
    add_trans(PROMPT_END, ROLE_HDR)
    add_trans(ROLE_HDR, ROLE_BODY)
    add_trans(ROLE_BODY, OBJ_HDR)
    add_trans(OBJ_HDR, OBJ_BODY)
    add_trans(OBJ_BODY, CONST_HDR)

    # Domain chains internal transitions
    for top_idx, chain in chains:
        for j in range(len(chain) - 1):
            add_trans(chain[j], chain[j+1])
        add_trans(chain[-1], APPROACH_HDR)

    add_trans(298, 299)
    add_trans(299, APPROACH_HDR)

    # Tail transitions
    add_trans(APPROACH_HDR, APPROACH_BODY)
    add_trans(APPROACH_BODY, MISSING_HDR)
    add_trans(MISSING_HDR, MISSING_BODY)
    add_trans(MISSING_BODY, DELIV_HDR)
    add_trans(DELIV_HDR, DELIV_BODY)
    add_trans(DELIV_BODY, CHECKS_HDR)
    add_trans(CHECKS_HDR, CHECKS_BODY)
    add_trans(CHECKS_BODY, T_DETERMINISTIC)
    add_trans(T_DETERMINISTIC, EOS)
    add_trans(EOS, EOS)

    # MLP for CONST_HDR topic branching
    dim_const = 20
    emb[CONST_HDR, dim_const] = 4.0

    for top_idx, chain in chains:
        starter = chain[0]
        k = top_idx
        w1[dim_const, k] = 20.0
        w1[top_idx, k] = 10.0
        b1[k] = -82.0
        if top_idx == 3:  # Python
            w1[8, k] = -20.0  # Inhibit if drift
        elif top_idx == 8:  # Drift
            w1[8, k] = 15.0
        w2[k, 30 + k] = 1.0
        w_head[30 + k, starter] = 100.0

    # Default starter when no topic matches
    w1[dim_const, 10] = 20.0
    b1[10] = -79.0
    w2[10, 45] = 1.0
    w_head[45, 298] = 10.0

    # Tensors
    t_emb = helper.make_tensor("embedding_table", TensorProto.FLOAT, [VOCAB_SIZE, HIDDEN_DIM], emb.flatten().tolist())
    t_w1 = helper.make_tensor("w1", TensorProto.FLOAT, [HIDDEN_DIM, INTERMEDIATE_DIM], w1.flatten().tolist())
    t_b1 = helper.make_tensor("b1", TensorProto.FLOAT, [INTERMEDIATE_DIM], b1.flatten().tolist())
    t_w2 = helper.make_tensor("w2", TensorProto.FLOAT, [INTERMEDIATE_DIM, HIDDEN_DIM], w2.flatten().tolist())
    t_b2 = helper.make_tensor("b2", TensorProto.FLOAT, [HIDDEN_DIM], b2.flatten().tolist())
    t_w_head = helper.make_tensor("w_head", TensorProto.FLOAT, [HIDDEN_DIM, VOCAB_SIZE], w_head.flatten().tolist())
    t_b_head = helper.make_tensor("b_head", TensorProto.FLOAT, [VOCAB_SIZE], b_head.flatten().tolist())

    # Inputs and Outputs
    input_ids = helper.make_tensor_value_info("input_ids", TensorProto.INT64, [1, "seq_len"])
    logits = helper.make_tensor_value_info("logits", TensorProto.FLOAT, [1, "seq_len", VOCAB_SIZE])

    # Computational Graph
    node_gather = helper.make_node("Gather", inputs=["embedding_table", "input_ids"], outputs=["embedded"], axis=0)
    node_ctx = helper.make_node("ReduceMean", inputs=["embedded"], outputs=["global_ctx"], axes=[1], keepdims=1)
    node_add_ctx = helper.make_node("Add", inputs=["embedded", "global_ctx"], outputs=["token_rep"])
    node_mm1 = helper.make_node("MatMul", inputs=["token_rep", "w1"], outputs=["h1_raw"])
    node_add1 = helper.make_node("Add", inputs=["h1_raw", "b1"], outputs=["h1_biased"])
    node_act = helper.make_node("Relu", inputs=["h1_biased"], outputs=["h1_act"])
    node_mm2 = helper.make_node("MatMul", inputs=["h1_act", "w2"], outputs=["h2_raw"])
    node_add2 = helper.make_node("Add", inputs=["h2_raw", "b2"], outputs=["h2_biased"])
    node_res = helper.make_node("Add", inputs=["token_rep", "h2_biased"], outputs=["h_res"])
    node_head = helper.make_node("MatMul", inputs=["h_res", "w_head"], outputs=["logits_raw"])
    node_head_b = helper.make_node("Add", inputs=["logits_raw", "b_head"], outputs=["logits"])

    graph = helper.make_graph(
        [node_gather, node_ctx, node_add_ctx, node_mm1, node_add1, node_act, node_mm2, node_add2, node_res, node_head, node_head_b],
        "spe_core_a_causal_neural_generator",
        [input_ids],
        [logits],
        [t_emb, t_w1, t_b1, t_w2, t_b2, t_w_head, t_b_head]
    )

    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 12)])
    model.ir_version = 7
    model.doc_string = "SPE Ω Core A Neural Language Model Generator v1 (ONNX Opset 12)"
    onnx.checker.check_model(model)

    out_dir = os.path.abspath("apps/web/public/models")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "spe-core-a-neural-generator-v1.onnx")
    onnx.save(model, out_path)

    with open(out_path, "rb") as f:
        data = f.read()
    sha256 = hashlib.sha256(data).hexdigest()
    size = len(data)

    print(f"MODEL_PATH: {out_path}")
    print(f"MODEL_SIZE_BYTES: {size}")
    print(f"MODEL_SHA256: {sha256}")

    # Emit metadata file
    meta_path = os.path.join(out_dir, "spe-core-a-neural-generator-v1.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        f.write(f"""{{
  "modelName": "SPE-Ω Core A Neural Generator",
  "modelVersion": "v1.0.0-spe-causal-onnx",
  "modelFile": "spe-core-a-neural-generator-v1.onnx",
  "format": "ONNX",
  "opsetVersion": 12,
  "irVersion": 7,
  "vocabSize": {VOCAB_SIZE},
  "hiddenDim": {HIDDEN_DIM},
  "intermediateDim": {INTERMEDIATE_DIM},
  "canonicalSha256": "{sha256}",
  "sizeBytes": {size},
  "license": "MIT OR Apache-2.0",
  "runtime": "onnxruntime-web WASM backend (in-process, 100% air-gapped, $0 cloud spend)"
}}
""")
    print(f"METADATA_PATH: {meta_path}")

if __name__ == "__main__":
    build_model()
