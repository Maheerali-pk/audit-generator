// ── Klaviyo GET /api/campaigns response ──────────────────────────────

export interface KlaviyoCampaignSendStrategy {
  method: string
  options_static?: {
    datetime: string
    is_local: boolean
    send_past_recipients_immediately: boolean | null
  } | null
  options_throttled?: unknown | null
  options_sto?: unknown | null
}

export interface KlaviyoCampaignAttributes {
  name: string
  status: string
  archived: boolean
  audiences: {
    included: string[]
    excluded: string[]
  }
  send_options: {
    use_smart_sending: boolean
  }
  tracking_options: {
    is_tracking_clicks: boolean
    is_tracking_opens: boolean
  }
  send_strategy: KlaviyoCampaignSendStrategy
  created_at: string
  scheduled_at: string | null
  updated_at: string
  send_time: string | null
}

export interface KlaviyoCampaign {
  type: "campaign"
  id: string
  attributes: KlaviyoCampaignAttributes
  links: {
    self: string
  }
}

export interface KlaviyoCampaignsResponse {
  data: KlaviyoCampaign[]
  links: {
    self: string
    next: string | null
    prev?: string | null
  }
}

// ── Klaviyo POST /api/campaign-values-reports response ───────────────

export type CampaignValuesStatistic =
  | "open_rate"
  | "click_rate"
  | "unsubscribe_rate"
  | "bounce_rate"
  | "conversion_value"
  | "recipients"
  | "delivered"
  | "opens"
  | "clicks"
  | "bounced"
  | "unsubscribes"
  | "conversion_rate"
  | "conversions"
  | "average_order_value"
  | "revenue_per_recipient"
  | "spam_complaint_rate"
  | "delivery_rate"
  | "click_to_open_rate"

export interface CampaignValuesReportResult {
  groupings: {
    campaign_id: string
    campaign_message_id: string
    send_channel: string
    [key: string]: string
  }
  statistics: Record<string, number>
}

export interface CampaignValuesReportResponse {
  data: {
    type: "campaign-values-report"
    attributes: {
      results: CampaignValuesReportResult[]
    }
  }
  links: {
    self: string
    next?: string | null
  }
}
