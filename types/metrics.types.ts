// ── Klaviyo GET /api/metrics response ────────────────────────────────

export interface KlaviyoMetricAttributes {
  name: string
  created: string
  updated: string
  integration: Record<string, unknown> | null
}

export interface KlaviyoMetric {
  type: "metric"
  id: string
  attributes: KlaviyoMetricAttributes
  links: {
    self: string
  }
  relationships?: {
    "flow-triggers"?: {
      data: { type: "flow"; id: string }[]
      links: { self: string; related: string }
    }
  }
}

export interface KlaviyoMetricsResponse {
  data: KlaviyoMetric[]
  links: {
    self: string
    first: string
    last: string
    prev: string | null
    next: string | null
  }
}

// ── Klaviyo POST /api/metric-aggregates request ──────────────────────

export type MetricMeasurement = "count" | "sum_value" | "unique"

export interface MetricAggregateRequestAttributes {
  metric_id: string
  measurements: MetricMeasurement[]
  filter: string[]
  interval?: "hour" | "day" | "week" | "month"
  timezone?: string
  by?: string[]
}

export interface MetricAggregateRequest {
  data: {
    type: "metric-aggregate"
    attributes: MetricAggregateRequestAttributes
  }
}

// ── Klaviyo POST /api/metric-aggregates response ─────────────────────

export interface MetricAggregateDataPoint {
  dimensions: string[]
  measurements: {
    count?: number[]
    sum_value?: number[]
    unique?: number[]
  }
}

export interface MetricAggregateResponseAttributes {
  dates: string[]
  data: MetricAggregateDataPoint[]
}

export interface MetricAggregateResponse {
  data: {
    type: "metric-aggregate"
    id: string
    attributes: MetricAggregateResponseAttributes
    links: {
      self: string
    }
  }
}
