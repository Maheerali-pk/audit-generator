// ── Klaviyo GET /api/flows response ──────────────────────────────────

export interface KlaviyoFlowAttributes {
  name: string
  status: string
  archived: boolean
  created: string
  updated: string
  trigger_type: string
}

export interface KlaviyoFlow {
  type: "flow"
  id: string
  attributes: KlaviyoFlowAttributes
  links: {
    self: string
  }
}

export interface KlaviyoFlowsResponse {
  data: KlaviyoFlow[]
  links: {
    self: string
    next: string | null
    prev?: string | null
  }
}

// ── Klaviyo GET /api/flows/{id}/flow-actions response ────────────────

export interface KlaviyoFlowActionTrackingOptions {
  add_utm: boolean
  utm_params: unknown[]
  is_tracking_opens: boolean
  is_tracking_clicks: boolean
}

export interface KlaviyoFlowActionSendOptions {
  use_smart_sending: boolean
  is_transactional: boolean
}

export interface KlaviyoFlowActionAttributes {
  action_type: string
  status: string
  created: string
  updated: string
  settings: Record<string, unknown>
  tracking_options: KlaviyoFlowActionTrackingOptions | null
  send_options: KlaviyoFlowActionSendOptions | null
  badge_options: unknown | null
  render_options: unknown | null
}

export interface KlaviyoFlowAction {
  type: "flow-action"
  id: string
  attributes: KlaviyoFlowActionAttributes
  relationships: {
    flow: {
      links: { self: string; related: string }
    }
    "flow-messages": {
      links: { self: string; related: string }
    }
  }
  links: {
    self: string
  }
}

export interface KlaviyoFlowActionsResponse {
  data: KlaviyoFlowAction[]
  links: {
    self: string
    next: string | null
    prev?: string | null
  }
}

// ── Klaviyo GET /api/flow-actions/{id}/flow-messages response ────────

export interface KlaviyoFlowMessageContent {
  subject: string
  preview_text: string
  from_email: string
  from_label: string
  reply_to_email: string
  cc_email: string
  bcc_email: string
}

export interface KlaviyoFlowMessageAttributes {
  name: string
  channel: string
  content: KlaviyoFlowMessageContent
  created: string
  updated: string
}

export interface KlaviyoFlowMessage {
  type: "flow-message"
  id: string
  attributes: KlaviyoFlowMessageAttributes
  relationships: {
    "flow-action": {
      links: { self: string; related: string }
    }
    template?: {
      data: { type: "template"; id: string }
      links: { self: string; related: string }
    }
  }
  links: {
    self: string
  }
}

export interface KlaviyoFlowMessagesResponse {
  data: KlaviyoFlowMessage[]
  links: {
    self: string
    first?: string | null
    last?: string | null
    next: string | null
    prev?: string | null
  }
}

// ── Klaviyo POST /api/flow-values-reports response ──────────────────

export type FlowValuesStatistic =
  | "recipients"
  | "revenue_per_recipient"
  | "conversion_value"
  | "conversion_rate"
  | "conversions"
  | "average_order_value"
  | "open_rate"
  | "click_rate"
  | "unsubscribe_rate"
  | "bounce_rate"
  | "delivered"
  | "opens"
  | "clicks"
  | "bounced"
  | "unsubscribes"
  | "spam_complaint_rate"
  | "delivery_rate"
  | "click_to_open_rate"

export interface FlowValuesReportResult {
  groupings: {
    flow_id: string
    send_channel: string
    flow_message_id: string
    [key: string]: string
  }
  statistics: Record<string, number>
}

export interface FlowValuesReportResponse {
  data: {
    type: "flow-values-report"
    attributes: {
      results: FlowValuesReportResult[]
    }
  }
  links: {
    self: string
    next?: string | null
  }
}
