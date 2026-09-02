# Feature Documentation: AI Confidence Threshold

## Overview
The AI Confidence Threshold feature ensures that low-confidence ML predictions are not blindly trusted by the automated system. It introduces a rigorous filtering step in the triage pipeline.

## Implementation Details
- **File:** `web/src/app/api/analyze/route.ts`
- **Logic:** After calling the PyTorch inference API, the backend examines the `confidence` score.
- **Threshold:** Set to 60%.
- **Action:** If `confidence < 60`, the incident `status` is forced to `PENDING` (or similar manual review state) and a `warning` flag is attached indicating "Low confidence prediction".

## Business Value
Prevents false positives from cluttering the automated response map, ensuring human-in-the-loop validation for edge cases while allowing high-confidence predictions to bypass manual review for speed.
