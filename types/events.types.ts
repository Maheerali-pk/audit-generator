// ── Klaviyo GET /api/events response ─────────────────────────────────

export interface KlaviyoEventProperties {
  cid?: string
  is_client?: boolean
  page_url?: string
  form_id?: string
  time?: string
  submitted_fields?: Record<string, unknown>
  form_type?: string
  href?: string
  form_version_c_id?: string
  action_type?: string
  hostname?: string
  device_type?: string
  form_version_id?: number
  $event_id?: string
  [key: string]: unknown
}

export interface KlaviyoEventAttributes {
  timestamp: number
  event_properties: KlaviyoEventProperties
  datetime: string
  uuid: string
}

export interface KlaviyoEvent {
  type: "event"
  id: string
  attributes: KlaviyoEventAttributes
  relationships: {
    profile?: {
      links: { self: string; related: string }
    }
    metric?: {
      data: { type: "metric"; id: string }
      links: { self: string; related: string }
    }
  }
  links: {
    self: string
  }
}

export interface KlaviyoEventsResponse {
  data: KlaviyoEvent[]
  links: {
    self: string
    next: string | null
    prev?: string | null
  }
}
