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
