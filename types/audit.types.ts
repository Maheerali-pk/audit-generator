// ── Audit Report Metrics (stored as single JSONB column) ──────────────

export interface AuditMetrics {
  // ── LIST GROWTH & HEALTH ──────────────────────────────────────────
  total_profiles: number | null
  active_email_subscribers: number | null
  suppressed_profiles: number | null
  suppressed_profiles_pct: number | null
  new_subscribers_30d: number | null
  new_subscribers_90d: number | null
  unsubscribe_rate: number | null
  list_growth_rate: number | null

  // ── POPUPS & FORMS ────────────────────────────────────────────────
  total_active_forms: number | null
  form_submit_rate: number | null
  email_capture_count_30d: number | null
  sms_capture_count_30d: number | null
  email_vs_sms_capture_ratio: number | null
  form_submissions_desktop: number | null
  form_submissions_mobile: number | null

  // ── FLOWS — AGGREGATE PERFORMANCE ─────────────────────────────────
  total_active_flows: number | null
  total_inactive_draft_flows: number | null
  welcome_flow_open_rate: number | null
  welcome_flow_click_rate: number | null
  welcome_flow_revenue: number | null
  abandoned_cart_open_rate: number | null
  abandoned_cart_click_rate: number | null
  abandoned_cart_recovery_rate: number | null
  browse_abandonment_open_rate: number | null
  browse_abandonment_click_rate: number | null
  post_purchase_open_rate: number | null
  post_purchase_click_rate: number | null
  winback_open_rate: number | null
  winback_click_rate: number | null
  sunset_flow_active: boolean | null
  flow_revenue_pct_of_total: number | null

  // ── CAMPAIGNS — PERFORMANCE ───────────────────────────────────────
  total_campaigns_sent_30d: number | null
  total_campaigns_sent_90d: number | null
  avg_campaign_open_rate: number | null
  avg_campaign_click_rate: number | null
  avg_campaign_unsubscribe_rate: number | null
  avg_campaign_bounce_rate: number | null
  campaign_revenue_30d: number | null
  campaign_revenue_90d: number | null
  revenue_per_recipient_avg: number | null
  campaign_revenue_pct_of_total: number | null
  top_campaign_by_revenue_name: string | null
  top_campaign_by_revenue_value: number | null
  bottom_campaign_by_open_rate_name: string | null
  bottom_campaign_by_open_rate_value: number | null

  // ── DELIVERABILITY & TECHNICAL HEALTH ─────────────────────────────
  overall_bounce_rate: number | null
  hard_bounce_rate: number | null
  spam_complaint_rate: number | null
  overall_open_rate: number | null
  email_deliverability_rate: number | null
  suppressed_profile_count: number | null
  integration_active: boolean | null
  total_email_revenue_30d: number | null
  total_email_revenue_90d: number | null
  email_revenue_pct_of_total: number | null
}

// ── Audit Report Row (matches Supabase audit_reports table) ──────────

export type AuditReportStatus = "in_progress" | "completed" | "failed"

export interface AuditReport {
  id: string
  klaviyo_account_id: string
  status: AuditReportStatus
  created_at: string | null
  metrics: AuditMetrics | null
  audit_version: string | null
  runtime_seconds: number | null
}

// ── Helper: empty metrics object (all nulls) ─────────────────────────

export function createEmptyMetrics(): AuditMetrics {
  return {
    // List Growth & Health
    total_profiles: null,
    active_email_subscribers: null,
    suppressed_profiles: null,
    suppressed_profiles_pct: null,
    new_subscribers_30d: null,
    new_subscribers_90d: null,
    unsubscribe_rate: null,
    list_growth_rate: null,

    // Popups & Forms
    total_active_forms: null,
    form_submit_rate: null,
    email_capture_count_30d: null,
    sms_capture_count_30d: null,
    email_vs_sms_capture_ratio: null,
    form_submissions_desktop: null,
    form_submissions_mobile: null,

    // Flows
    total_active_flows: null,
    total_inactive_draft_flows: null,
    welcome_flow_open_rate: null,
    welcome_flow_click_rate: null,
    welcome_flow_revenue: null,
    abandoned_cart_open_rate: null,
    abandoned_cart_click_rate: null,
    abandoned_cart_recovery_rate: null,
    browse_abandonment_open_rate: null,
    browse_abandonment_click_rate: null,
    post_purchase_open_rate: null,
    post_purchase_click_rate: null,
    winback_open_rate: null,
    winback_click_rate: null,
    sunset_flow_active: null,
    flow_revenue_pct_of_total: null,

    // Campaigns
    total_campaigns_sent_30d: null,
    total_campaigns_sent_90d: null,
    avg_campaign_open_rate: null,
    avg_campaign_click_rate: null,
    avg_campaign_unsubscribe_rate: null,
    avg_campaign_bounce_rate: null,
    campaign_revenue_30d: null,
    campaign_revenue_90d: null,
    revenue_per_recipient_avg: null,
    campaign_revenue_pct_of_total: null,
    top_campaign_by_revenue_name: null,
    top_campaign_by_revenue_value: null,
    bottom_campaign_by_open_rate_name: null,
    bottom_campaign_by_open_rate_value: null,

    // Deliverability & Technical Health
    overall_bounce_rate: null,
    hard_bounce_rate: null,
    spam_complaint_rate: null,
    overall_open_rate: null,
    email_deliverability_rate: null,
    suppressed_profile_count: null,
    integration_active: null,
    total_email_revenue_30d: null,
    total_email_revenue_90d: null,
    email_revenue_pct_of_total: null,
  }
}
