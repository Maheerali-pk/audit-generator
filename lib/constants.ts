import type { AuditMetrics } from "@/types/audit.types"
import type {
  FlowCategory,
  FlowCategoryMeta,
  FlowMappings,
} from "@/types/custom-config.types"

// ── Format types for rendering metric values ─────────────────────────

export type MetricFormat = "number" | "percent" | "currency" | "boolean"

export interface MetricMeta {
  label: string
  format: MetricFormat
  section: string
}

// ── Metric key → display name + format + section ─────────────────────

export const AUDIT_METRIC_META: Record<keyof AuditMetrics, MetricMeta> = {
  // List Growth & Health
  total_profiles: { label: "Total Profiles", format: "number", section: "List Growth & Health" },
  active_email_subscribers: { label: "Active Email Subscribers", format: "number", section: "List Growth & Health" },
  suppressed_profiles: { label: "Suppressed Profiles", format: "number", section: "List Growth & Health" },
  suppressed_profiles_pct: { label: "Suppressed Profiles %", format: "percent", section: "List Growth & Health" },
  new_subscribers_30d: { label: "New Subscribers (30d)", format: "number", section: "List Growth & Health" },
  new_subscribers_90d: { label: "New Subscribers (90d)", format: "number", section: "List Growth & Health" },
  unsubscribe_rate: { label: "Unsubscribe Rate", format: "percent", section: "List Growth & Health" },
  list_growth_rate: { label: "List Growth Rate", format: "percent", section: "List Growth & Health" },

  // Popups & Forms
  total_active_forms: { label: "Total Active Forms", format: "number", section: "Popups & Forms" },
  form_submit_rate: { label: "Form Submit Rate", format: "percent", section: "Popups & Forms" },
  email_capture_count_30d: { label: "Email Capture Count (30d)", format: "number", section: "Popups & Forms" },
  sms_capture_count_30d: { label: "SMS Capture Count (30d)", format: "number", section: "Popups & Forms" },
  email_vs_sms_capture_ratio: { label: "Email vs SMS Capture Ratio", format: "number", section: "Popups & Forms" },
  form_submissions_desktop: { label: "Form Submissions — Desktop %", format: "percent", section: "Popups & Forms" },
  form_submissions_mobile: { label: "Form Submissions — Mobile %", format: "percent", section: "Popups & Forms" },

  // Flows
  total_active_flows: { label: "Total Active Flows", format: "number", section: "Flows" },
  total_inactive_draft_flows: { label: "Total Inactive/Draft Flows", format: "number", section: "Flows" },
  welcome_flow_open_rate: { label: "Welcome Flow — Open Rate", format: "percent", section: "Flows" },
  welcome_flow_click_rate: { label: "Welcome Flow — Click Rate", format: "percent", section: "Flows" },
  welcome_flow_revenue: { label: "Welcome Flow — Revenue", format: "currency", section: "Flows" },
  abandoned_cart_open_rate: { label: "Abandoned Cart — Open Rate", format: "percent", section: "Flows" },
  abandoned_cart_click_rate: { label: "Abandoned Cart — Click Rate", format: "percent", section: "Flows" },
  abandoned_cart_recovery_rate: { label: "Abandoned Cart — Recovery Rate", format: "percent", section: "Flows" },
  browse_abandonment_open_rate: { label: "Browse Abandonment — Open Rate", format: "percent", section: "Flows" },
  browse_abandonment_click_rate: { label: "Browse Abandonment — Click Rate", format: "percent", section: "Flows" },
  post_purchase_open_rate: { label: "Post-Purchase — Open Rate", format: "percent", section: "Flows" },
  post_purchase_click_rate: { label: "Post-Purchase — Click Rate", format: "percent", section: "Flows" },
  winback_open_rate: { label: "Winback — Open Rate", format: "percent", section: "Flows" },
  winback_click_rate: { label: "Winback — Click Rate", format: "percent", section: "Flows" },
  sunset_flow_active: { label: "Sunset Flow — Active?", format: "boolean", section: "Flows" },
  flow_revenue_pct_of_total: { label: "Flow Revenue as % of Total Email Revenue", format: "percent", section: "Flows" },

  // Campaigns
  total_campaigns_sent_30d: { label: "Total Campaigns Sent (30d)", format: "number", section: "Campaigns" },
  total_campaigns_sent_90d: { label: "Total Campaigns Sent (90d)", format: "number", section: "Campaigns" },
  avg_campaign_open_rate: { label: "Avg Campaign Open Rate", format: "percent", section: "Campaigns" },
  avg_campaign_click_rate: { label: "Avg Campaign Click Rate", format: "percent", section: "Campaigns" },
  avg_campaign_unsubscribe_rate: { label: "Avg Campaign Unsubscribe Rate", format: "percent", section: "Campaigns" },
  avg_campaign_bounce_rate: { label: "Avg Campaign Bounce Rate", format: "percent", section: "Campaigns" },
  campaign_revenue_30d: { label: "Campaign Revenue (30d)", format: "currency", section: "Campaigns" },
  campaign_revenue_90d: { label: "Campaign Revenue (90d)", format: "currency", section: "Campaigns" },
  revenue_per_recipient_avg: { label: "Revenue Per Recipient (Avg)", format: "currency", section: "Campaigns" },
  campaign_revenue_pct_of_total: { label: "Campaign Revenue as % of Total Email Revenue", format: "percent", section: "Campaigns" },
  top_campaign_by_revenue_name: { label: "Top Campaign by Revenue", format: "number", section: "Campaigns" },
  top_campaign_by_revenue_value: { label: "Top Campaign by Revenue ($)", format: "currency", section: "Campaigns" },
  bottom_campaign_by_open_rate_name: { label: "Bottom Campaign by Open Rate", format: "number", section: "Campaigns" },
  bottom_campaign_by_open_rate_value: { label: "Bottom Campaign by Open Rate (%)", format: "percent", section: "Campaigns" },

  // Deliverability & Technical Health
  overall_bounce_rate: { label: "Overall Bounce Rate", format: "percent", section: "Deliverability" },
  hard_bounce_rate: { label: "Hard Bounce Rate", format: "percent", section: "Deliverability" },
  spam_complaint_rate: { label: "Spam Complaint Rate", format: "percent", section: "Deliverability" },
  overall_open_rate: { label: "Overall Open Rate", format: "percent", section: "Deliverability" },
  email_deliverability_rate: { label: "Email Deliverability Rate", format: "percent", section: "Deliverability" },
  suppressed_profile_count: { label: "Suppressed Profile Count", format: "number", section: "Deliverability" },
  integration_active: { label: "Integration Active?", format: "boolean", section: "Deliverability" },
  total_email_revenue_30d: { label: "Total Email Revenue (30d)", format: "currency", section: "Deliverability" },
  total_email_revenue_90d: { label: "Total Email Revenue (90d)", format: "currency", section: "Deliverability" },
  email_revenue_pct_of_total: { label: "Email Revenue as % of Total Revenue", format: "percent", section: "Deliverability" },
}

// ── Audit Sections (feature checkboxes) ──────────────────────────────

export interface AuditSection {
  id: string
  label: string
  description: string
}

export const AUDIT_SECTIONS: AuditSection[] = [
  {
    id: "email_marketing",
    label: "Email Marketing",
    description: "List growth, subscribers, unsubscribe rate, deliverability metrics",
  },
  {
    id: "popups_forms",
    label: "Popups & Forms",
    description: "Active forms and form performance metrics",
  },
  {
    id: "flows",
    label: "Flows",
    description: "Active flows, flow performance, and revenue attribution",
  },
]

// ── Format a metric value for display ────────────────────────────────

export function formatMetricValue(
  value: number | boolean | string | null,
  format: MetricFormat
): string {
  if (value === null || value === undefined) return "—"

  switch (format) {
    case "number":
      return typeof value === "number"
        ? value.toLocaleString()
        : String(value)
    case "percent":
      return typeof value === "number" ? `${value}%` : String(value)
    case "currency":
      return typeof value === "number"
        ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value)
    case "boolean":
      return value ? "Yes" : "No"
    default:
      return String(value)
  }
}

// ── Flow Category Metadata ───────────────────────────────────────────

export const FLOW_CATEGORIES: FlowCategoryMeta[] = [
  { key: "welcome", label: "Welcome Flow", description: "Welcome series / new subscriber onboarding" },
  { key: "abandoned_cart", label: "Abandoned Cart", description: "Cart abandonment recovery flows" },
  { key: "browse_abandonment", label: "Browse Abandonment", description: "Browse abandonment re-engagement" },
  { key: "post_purchase", label: "Post-Purchase", description: "Post-purchase follow-up and thank you" },
  { key: "winback", label: "Winback", description: "Customer winback and re-engagement" },
]

/** Keywords used by "Auto Add Flows" to match flow names (case-insensitive includes) */
export const FLOW_AUTO_KEYWORDS: Record<FlowCategory, string[]> = {
  welcome: ["welcome"],
  abandoned_cart: ["abandoned cart", "cart abandon", "checkout abandon"],
  browse_abandonment: ["browse abandon", "browsing abandon"],
  post_purchase: ["post purchase", "post-purchase", "thank you", "customer thank"],
  winback: ["winback", "win back", "win-back", "re-engage", "lapsed"],
}

export const DEFAULT_FLOW_MAPPINGS: FlowMappings = {
  welcome: [],
  abandoned_cart: [],
  browse_abandonment: [],
  post_purchase: [],
  winback: [],
}

export function createEmptyFlowMappings(): FlowMappings {
  return { ...DEFAULT_FLOW_MAPPINGS }
}
