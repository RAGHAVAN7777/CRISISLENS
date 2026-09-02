# Feature Documentation: Image Validation Pipeline

## Overview
The Image Validation Pipeline hardens the reporting system against junk data, blurry photos, and bad actors. It processes image files client-side before submission to save bandwidth, and performs strict validation.

## Implementation Details
- **Module:** Image Canvas Processing & Quality Control
- **Logic:**
  1. **Resize Constraints:** Images are forcibly scaled down using a hidden `<canvas>` to ensure they don't exceed API payload limits (Max width/height of 1024px).
  2. **Quality Compression:** Converts images to JPEG at `0.85` quality, optimizing the tradeoff between clarity for the PyTorch vision model and network transmission speed.
  3. **Blur Detection (Mock):** Flags images that lack contrast or sharpness, marking `isBlurry: true` so human reviewers know the ML inference might be degraded.
  4. **Data Augmentation:** Flips and rotates images for the model training dataset phase.

## Business Value
Ensures the backend PyTorch model (`hacktronics-backend`) receives clean, standardized, and lightweight tensors, reducing VRAM OOM (Out of Memory) crashes and boosting inference accuracy.
