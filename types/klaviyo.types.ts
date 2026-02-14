// ── Klaviyo Profile Types ──────────────────────────────────────────────

export interface KlaviyoProfileLocation {
  address1: string | null
  address2: string | null
  city: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  region: string | null
  zip: string | null
  timezone: string | null
  ip: string | null
}

export interface KlaviyoEmailMarketingConsent {
  can_receive_email_marketing: boolean
  consent: string
  consent_timestamp: string | null
  last_updated: string | null
  method: string | null
  method_detail: string | null
  custom_method_detail: string | null
  double_optin: string | null
  suppression: unknown[]
  list_suppressions: unknown[]
}

export interface KlaviyoSmsMarketingConsent {
  can_receive_sms_marketing: boolean
  consent: string
  consent_timestamp: string | null
  method: string | null
  method_detail: string | null
  last_updated: string | null
}

export interface KlaviyoSmsTransactionalConsent {
  can_receive_sms_transactional: boolean
  consent: string
  consent_timestamp: string | null
  method: string | null
  method_detail: string | null
  last_updated: string | null
}

export interface KlaviyoMobilePushConsent {
  can_receive_push_marketing: boolean
  consent: string
  consent_timestamp: string | null
}

export interface KlaviyoSubscriptions {
  email: {
    marketing: KlaviyoEmailMarketingConsent
  }
  sms: {
    marketing: KlaviyoSmsMarketingConsent
    transactional: KlaviyoSmsTransactionalConsent
  }
  mobile_push: {
    marketing: KlaviyoMobilePushConsent
  }
  whatsapp: Record<string, unknown> | null
}

export interface KlaviyoProfileAttributes {
  email: string | null
  phone_number: string | null
  external_id: string | null
  anonymous_id: string | null
  first_name: string | null
  last_name: string | null
  organization: string | null
  locale: string | null
  title: string | null
  image: string | null
  created: string
  updated: string
  last_event_date: string | null
  location: KlaviyoProfileLocation
  properties: Record<string, unknown>
  subscriptions: KlaviyoSubscriptions
}

export interface KlaviyoRelationshipLinks {
  self: string
  related: string
}

export interface KlaviyoProfileRelationships {
  lists: { links: KlaviyoRelationshipLinks }
  segments: { links: KlaviyoRelationshipLinks }
  "push-tokens": { links: KlaviyoRelationshipLinks }
  conversation: { links: KlaviyoRelationshipLinks }
}

export interface KlaviyoProfile {
  type: "profile"
  id: string
  attributes: KlaviyoProfileAttributes
  relationships: KlaviyoProfileRelationships
  links: {
    self: string
  }
}

// ── Klaviyo API Response Types ────────────────────────────────────────

export interface KlaviyoProfilesResponse {
  data: KlaviyoProfile[]
  links: {
    self: string
    next: string | null
    prev: string | null
  }
}
