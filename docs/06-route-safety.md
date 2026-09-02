# Feature Documentation: Route Safety Validation

## Overview
Disaster routing cannot blindly trust shortest-path algorithms. The Route Safety Validation feature intercepts naive routing requests that would put a citizen in immediate danger by starting or ending inside a known hazard perimeter.

## Implementation Details
- **Files:** `web/src/app/routing/page.tsx`, `web/src/lib/services/realRoutingService.ts`
- **Logic:**
  1. Retrieves all `activeHazards` (excluding resolved/rejected ones).
  2. Before executing `calculateRouteForShelter`, loops through all hazards.
  3. Uses spherical Haversine geometry (`distMeters`) to check if the user's `origin` OR the chosen shelter's `destination` is `< 200m` from a hazard epicenter.
  4. Triggers an explicit warning UI block halting the user ("WARNING: Origin/Destination is inside an active hazard zone") before displaying the route details.
  5. Distance metrics were upgraded from flat Euclidean approximations to true spherical Haversine distances to properly handle global coordinate gaps.
  6. Added a "Use My GPS" origin toggle so users are not defaulting to hardcoded demo coords (LA).

## Business Value
Prevents the system from inadvertently guiding victims *into* active danger zones or providing false hope about compromised safety shelters.
