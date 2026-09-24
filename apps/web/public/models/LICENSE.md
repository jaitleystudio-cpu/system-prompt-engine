# SPE V1 vision pack (lazy STANDARD)

| Asset | Approx size | License | Role |
| --- | --- | --- | --- |
| `mobilenetv2-12-int8.onnx` | ~3.5 MB | Apache-2.0 (onnx/models) | ImageNet subject labels — MODEL_JUDGMENT |
| `imagenet_classes.txt` | ~11 KB | BSD-style (PyTorch hub labels) | Class names |
| `/ort/ort-wasm-simd-threaded.wasm` | ~11 MB | MIT (ONNX Runtime) | In-browser inference |

- Homepage `VISION_MODEL_BYTES = 0` until Image / Screenshot / Video requests STANDARD.
- User media never leaves the device for inference (no cloud vision API).
- Model weights load from same origin only (`connect-src 'self'`).
- Cold start dominated by ~14.5 MB first download; warm infer often 50–400 ms on desktop WASM.
- Peak memory device-dependent (~80–200 MB during STANDARD).
