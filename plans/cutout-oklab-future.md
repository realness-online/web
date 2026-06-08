# Cutout Tracer – OKLab Color Space (Future Improvement)

## Current State

The v-tracer (Rust WASM, visioncortex) outputs cutout colors as RGB. Clustering and `residue_color` operate in RGB space. The JS side uses `rgb(r, g, b)` for fill.

## Potential Improvement

Switch visioncortex clustering to OKLab. Benefits:

**Clustering distance** – RGB Euclidean distance is not perceptually uniform. OKLab distances align better with human perception, so similar-looking pixels would cluster together more reliably.

**Residue color** – Averaging cluster pixels in RGB can produce counterintuitive results. OKLab averaging tends to stay perceptually meaningful.

**Parameters** – Thresholds like `layer_difference` and `is_same_color_a` would behave more consistently across hue/lightness.

## Constraint

visioncortex is an external, RGB-native library. Requires either forking with OKLab support or upstream changes. Converting only the output to OKLab would not affect clustering quality—the improvement comes from clustering in OKLab.
