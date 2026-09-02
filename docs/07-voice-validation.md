# Feature Documentation: Voice UI Validation Constraints

## Overview
The Voice Report Simulator serves as an interactive mock for the IVR (Interactive Voice Response) telephony integration. Without proper constraints, automated phone systems can submit empty or excessively long audio payloads, causing transcription API failures or bloated storage costs.

## Implementation Details
- **File:** `web/src/app/voice/page.tsx`
- **Logic:** 
  - Overhauled the static UI into an interactive React component tracking `isRecording`, `transcript`, and `duration` (via `useRef` and `setInterval`).
  - **Length Bounds:** Enforces `Duration >= 1 second` and `Duration <= 60 seconds`. Exceeding 60 seconds triggers auto-cutoff.
  - **Silence Checks:** Validates that the transcript string is not empty or entirely whitespace (`!transcript.trim()`).
  - **Error Handling:** Renders clear UI error alerts if any constraint is breached rather than silently failing or crashing.

## Business Value
Ensures that the downstream Speech-to-Text inference pipeline only processes valid, non-empty, and reasonably-sized audio streams, maintaining high throughput for the crisis hotline.
