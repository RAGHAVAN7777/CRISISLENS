# Feature Documentation: Map Clustering & Staleness

## Overview
As crises unfold, hundreds of redundant reports can flood the system for the same physical event. Map Clustering and Staleness visually declutters the command center view to prevent cognitive overload for first responders.

## Implementation Details
- **Files:** `web/src/components/MapComponent.tsx`, `web/src/lib/services/ai.ts`
- **Logic:**
  1. **Spatial Clustering:** Utilizes `react-leaflet-cluster` wrapped around `Marker` arrays. Overlapping pins at low zoom levels automatically aggregate into numbered cluster nodes. Requires `chunkedLoading` for performance.
  2. **Deduplication:** The `processIncidentData` function uses the Haversine formula to compare incoming reports against existing database entries. If `distMeters < 100` and `timeDelta < 30mins` for the same hazard type, it is merged.
  3. **Visual Staleness:** Incidents older than 24 hours are assigned a `STALE` status. They render on the map with a grayscale filter and 40% opacity, visually de-prioritizing them compared to active emergencies.
  4. **Time Filtering:** Default query ignores incidents older than 72 hours, with a UI toggle switch to "Load older reports".

## Business Value
Transforms an unreadable sea of red pins into an actionable, prioritized heat map of active threats.
