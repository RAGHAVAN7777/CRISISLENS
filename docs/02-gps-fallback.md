# Feature Documentation: GPS Fallback

## Overview
The GPS Fallback system acts as a safety net for incident reporting. In chaotic disaster scenarios, users may upload photos stripped of EXIF data (e.g., sent via messaging apps) or taken without location permissions. 

## Implementation Details
- **File:** `web/src/app/report/page.tsx`
- **Logic:** During the report submission flow, the system attempts to extract geographic coordinates. If EXIF data is absent, the fallback triggers the HTML5 `navigator.geolocation` API.
- **Workflow:**
  1. Image is loaded.
  2. System detects `lat/lng = null`.
  3. Invokes `navigator.geolocation.getCurrentPosition`.
  4. Binds the user's real-time device location to the incident payload.
  5. If location is denied entirely, it falls back to a DEMO coordinate for testing purposes.

## Business Value
Ensures that 100% of submitted incidents are geospatially anchored, allowing the routing and clustering engines to operate without catastrophic null-reference failures.
