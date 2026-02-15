// ── Klaviyo POST /api/form-values-reports response ──────────────────

export interface FormValuesReportStatistics {
  viewed_form: number
  submits: number
}

export interface FormValuesReportResult {
  groupings: {
    form_id: string
  }
  statistics: FormValuesReportStatistics
}

export interface FormValuesReportResponse {
  data: {
    type: "form-values-report"
    id: string
    attributes: {
      results: FormValuesReportResult[]
    }
  }
  links: {
    self: string
  }
}

// ── Klaviyo GET /api/forms response ──────────────────────────────────

export interface KlaviyoFormAttributes {
  name: string
  status: string
  ab_test: boolean
  created_at: string
  updated_at: string
}

export interface KlaviyoForm {
  type: "form"
  id: string
  attributes: KlaviyoFormAttributes
  relationships?: {
    "form-versions"?: {
      data: { type: "form-version"; id: string }[]
      links: { self: string; related: string }
    }
  }
  links: {
    self: string
  }
}

export interface KlaviyoFormsResponse {
  data: KlaviyoForm[]
  links: {
    self: string
    first?: string
    last?: string
    prev: string | null
    next: string | null
  }
}
