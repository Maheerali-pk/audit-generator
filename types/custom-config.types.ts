// ── Flow Mapping Types ───────────────────────────────────────────────

/** A single flow entry stored in the mapping */
export interface FlowMappingEntry {
  flow_id: string
  flow_name: string
}

/** Static flow category keys used across the audit system */
export type FlowCategory =
  | "welcome"
  | "abandoned_cart"
  | "browse_abandonment"
  | "post_purchase"
  | "winback"

/** Flow mappings stored as JSONB on klaviyo_accounts */
export type FlowMappings = Record<FlowCategory, FlowMappingEntry[]>

/** Metadata for each flow category (for UI display) */
export interface FlowCategoryMeta {
  key: FlowCategory
  label: string
  description: string
}
