#!/bin/bash
# Shrink a downloaded photogrammetry model for web + VR headsets.
# Usage: tools/optimize.sh <input.glb> <output.glb> [ratio]
#   ratio = share of triangles to keep (default 0.15 ≈ 1.1M → ~160k)
set -euo pipefail
IN="$1"; OUT="$2"; RATIO="${3:-0.15}"
npx --yes @gltf-transform/cli@4.1.1 optimize "$IN" "$OUT" \
  --simplify true --simplify-ratio "$RATIO" --simplify-error 0.001 \
  --compress meshopt --texture-compress webp --texture-size 2048
ls -lh "$IN" "$OUT"
