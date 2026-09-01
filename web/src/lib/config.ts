/**
 * Central configuration for the Disaster Intelligence Network.
 * All magic numbers live here — never scatter them through component code.
 */

// ── Blur Detection ────────────────────────────────────────────────────────────
/**
 * Laplacian variance threshold.
 * Images scoring BELOW this are considered blurry.
 * Typical range: sharp images score 200-1000+; blurry < 100.
 */
export const BLUR_THRESHOLD = 100;

// ── AI Confidence ─────────────────────────────────────────────────────────────
/**
 * Minimum confidence (0–100 scale) required for AI results to be treated
 * as reliable WITHOUT field verification.
 * Reports below this automatically trigger verificationRequired = true.
 */
export const CONFIDENCE_THRESHOLD = 70; // 70% — configurable

// ── Incident Fusion ───────────────────────────────────────────────────────────
/**
 * Degree-based radius for considering two reports as the "same incident."
 * ~0.05° ≈ 5 km at mid-latitudes.
 */
export const PROXIMITY_THRESHOLD_DEG = 0.05;

// ── Route Risk ────────────────────────────────────────────────────────────────
/**
 * Degree-based radius to match incidents to nearby road edges.
 * ~0.015° ≈ 1.5 km.
 */
export const ROAD_PROXIMITY_THRESHOLD = 0.015;

// ── Volunteer Phone Numbers ───────────────────────────────────────────────────
/**
 * Volunteer recipients for disaster alerts in E.164 format.
 */
export const VOLUNTEER_PHONE_NUMBERS = [
  "+918838250227",
  "+919444562413"
];

// ── Disaster Time Machine — Risk Forecast Engine ──────────────────────────────

/** Severity → base weight (0–1) */
export const SEVERITY_WEIGHTS: Record<string, number> = {
  LOW:      0.25,
  MEDIUM:   0.50,
  HIGH:     0.75,
  CRITICAL: 1.00,
};

/** Verification status → confidence multiplier (0–1) */
export const VERIFICATION_WEIGHTS: Record<string, number> = {
  VERIFIED:                    1.00,
  PARTIALLY_VERIFIED:          0.85,
  VERIFICATION_IN_PROGRESS:    0.80,
  FIELD_VERIFICATION_REQUIRED: 0.65,
  UNVERIFIED:                  0.50,
  UNABLE_TO_VERIFY:            0.40,
  FALSE_REPORT:                0.00,
};

/** Base expansion radius in meters at each forecast horizon */
export const BASE_EXPANSION_RADII_M: Record<string, number> = {
  NOW:    100,
  T15:    250,
  T30:    400,
  T60:    650,
};

/** Per-disaster-type spatial expansion multiplier (relative to base radii) */
export const DISASTER_EXPANSION_FACTORS: Record<string, number> = {
  flood:       1.40,
  fire:        1.20,
  hurricane:   1.35,
  earthquake:  0.70,
  landslide:   0.55,
  other_disaster: 1.00,
  not_disaster:   0.10,
};

/** Trend thresholds: reports within TREND_WINDOW_MS */
export const TREND_WINDOW_MS    = 10 * 60 * 1000; // 10 minutes
export const TREND_INCREASING   = 3; // ≥3 reports in window → INCREASING
export const TREND_STRONG       = 5; // ≥5 → STRONGLY INCREASING

