# Feature Documentation: Responder Queue Triage

## Overview
The Responder Queue dictates what operators see first when reviewing incoming unverified incidents. By default, chronological sorting is dangerous in a crisis because a minor incident might overshadow a critical emergency just because it arrived 5 minutes earlier.

## Implementation Details
- **File:** `web/src/app/responder/page.tsx`
- **Logic:** Implemented a two-pass sorting algorithm for the `verificationQueue`.
  1. **Primary Sort (Severity):** Maps severity string enums to numeric weights (`CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNCERTAIN: 0`). Sorts descending so `CRITICAL` always floats to the top.
  2. **Secondary Sort (Chronological):** If two incidents share the exact same severity tier, the oldest one (`createdAt` ascending) takes precedence so older critical incidents don't get permanently buried by incoming ones.

## Business Value
Ensures human operators are always dedicating their finite attention to the highest-risk emergencies first, maximizing the life-saving potential of the system.
