# G12-G custody proof — BEFORE DOWNLOAD

DATE_LOCAL=2026-10-01 Asia/Calcutta (IST)
MACHINE=Prawins-Mac-mini.local Apple M2 arm64 8 GB

## Challenger candidate (proposed)

UPSTREAM_REPO=https://huggingface.co/ukta-app/indic-whisper-ggml
UPSTREAM_COMMIT=a3d637b81797a1d680e6933b71058ac9e00681fd
UPSTREAM_FILE_INTRODUCED_COMMIT=4168702a4120ab864413cd6f61d0baba89352cec
MODEL_FILE=ggml-te-small.bin
MODEL_BYTES=190085487
SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
LICENSE=Apache-2.0
WHISPER_CPP_COMPATIBILITY=YES
WHISPER_CPP_NOTES=ggml q5_1 quantized monolingual Telugu; for whisper.cpp; fine-tunes trained without timestamp tokens — use -nt / no_timestamps
FINE_TUNE_SOURCE_REPO=https://huggingface.co/vasista22/whisper-telugu-small
FINE_TUNE_SOURCE_COMMIT=717212f9c4c16a78a86ddcb98f93c7f73ef8a5cc
FINE_TUNE_LICENSE=Apache-2.0
BASE_ARCH_LICENSE=MIT (OpenAI Whisper)
QUANT=q5_1
DOWNLOAD_URL=https://huggingface.co/ukta-app/indic-whisper-ggml/resolve/a3d637b81797a1d680e6933b71058ac9e00681fd/ggml-te-small.bin

## Cross-custody (identical LFS blob)

SECONDARY_REPO=https://huggingface.co/bhaskaro/ainotes-whisper-telugu-q5_1
SECONDARY_COMMIT=11bb1860bf271666c5f3ae709b7414cf993608b4
SECONDARY_MODEL_FILE=ggml-model.bin
SECONDARY_SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
SECONDARY_BYTES=190085487
CROSS_CUSTODY=PASS (identical LFS oid)

## Baseline (existing G12-C custody; no re-download)

BASELINE_MODEL_FILE=ggml-small.bin
BASELINE_BYTES=487601967
BASELINE_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
BASELINE_URL=https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin
BASELINE_LICENSE=MIT
BASELINE_PATH=/Volumes/4TB-WD/spe-worktrees/spe-g12c-media-backend-qual-20261001/proof/media-r1/models/ggml-small.bin

## Runtime pin

SOURCE_PIN=927cfce34f31707e17f2bff35c349632fb9e2c3a
BINARY_PATH=/Volumes/4TB-WD/spe-worktrees/spe-g12c-media-backend-qual-20261001/proof/media-r1/build/whisper-cmake/bin/whisper-cli
BINARY_SHA256=784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7

## Gate

CUSTODY_PRECHECK=PASS
ARBITRARY_MIRROR=NO
HOLD_REASON=none
