/**
 * Application-wide constants.
 * Proficiency threshold should match backend PROFICIENCY_THRESHOLD env var.
 */

// 80% proficiency threshold (school-configurable, default is 80%)
export const PROFICIENCY_THRESHOLD_PCT = 80;

// 60% partially proficient threshold
export const PARTIAL_PROFICIENCY_THRESHOLD_PCT = 60;

// Intervention tier thresholds (percentage)
export const TIER_1_MIN_PCT = 85; // Enrichment
export const TIER_2_MIN_PCT = 60; // Strategic
// Below TIER_2_MIN_PCT = Tier 3 (Intensive)

// Small group suppression (must match backend SMALL_GROUP_SUPPRESSION_THRESHOLD)
export const SUPPRESSION_THRESHOLD = 5;

// Chart color palette (consistent across all charts)
export const CHART_COLORS = {
  proficient:          "#10B981", // Green (80–100%)
  partiallyProficient: "#F59E0B", // Amber (60–79.9%)
  notProficient:       "#EF4444", // Red (0–59.9%)
  suppressed:   "#D1D5DB", // Gray
  tier1:        "#10B981",
  tier2:        "#F59E0B",
  tier3:        "#EF4444",
  primary:      "#1E3A5F",
  accent:       "#2E86AB",
};
