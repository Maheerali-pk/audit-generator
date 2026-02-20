import type {
  KlaviyoProfile,
  KlaviyoProfilesResponse,
} from "@/types/klaviyo.types"
import type {
  KlaviyoMetric,
  KlaviyoMetricsResponse,
  MetricAggregateRequest,
  MetricAggregateResponse,
  MetricMeasurement,
} from "@/types/metrics.types"
import type {
  KlaviyoForm,
  KlaviyoFormsResponse,
  FormValuesReportResponse,
} from "@/types/forms.types"
import type {
  KlaviyoEvent,
  KlaviyoEventsResponse,
} from "@/types/events.types"
import type {
  KlaviyoFlow,
  KlaviyoFlowAction,
  KlaviyoFlowActionsResponse,
  KlaviyoFlowMessage,
  KlaviyoFlowMessagesResponse,
  KlaviyoFlowsResponse,
  FlowValuesStatistic,
  FlowValuesReportResult,
  FlowValuesReportResponse,
} from "@/types/flows.types"
import type {
  KlaviyoCampaign,
  KlaviyoCampaignsResponse,
  CampaignValuesStatistic,
  CampaignValuesReportResult,
  CampaignValuesReportResponse,
} from "@/types/campaigns.types"

export const KLAVIYO_BASE_URL = "https://a.klaviyo.com"

const KLAVIYO_API_REVISION = "2024-10-15"

/** Standard headers for every Klaviyo request */
function klaviyoHeaders(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: KLAVIYO_API_REVISION,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
}

/**
 * Wraps a fetch call with automatic retry on 429 (rate-limited) responses.
 * Parses the "Expected available in X seconds" from the error body and waits
 * accordingly, with a fallback of 10 s. Retries up to `maxRetries` times.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 5
): Promise<Response> {
  let lastBodyText = ""
  let lastStatus = 429
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(input, init)

    if (response.status !== 429) return response

    lastBodyText = await response.text()
    lastStatus = response.status
    const waitMatch = lastBodyText.match(/available in (\d+) second/)
    const waitSeconds = waitMatch ? parseInt(waitMatch[1], 10) : 10
    const delay = (waitSeconds + 2) * 1000

    console.warn(
      `[klaviyo] 429 throttled (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitSeconds + 2}s...`
    )
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  return new Response(lastBodyText, { status: lastStatus })
}

/**
 * Fetches ALL profiles with subscription data from Klaviyo,
 * handling pagination internally. Returns the complete array of profiles.
 */
export async function getAllProfilesWithSubscriptionData(
  apiKey: string
): Promise<KlaviyoProfile[]> {
  const allProfiles: KlaviyoProfile[] = []

  let nextUrl: string | null =
    `${KLAVIYO_BASE_URL}/api/profiles?additional-fields%5Bprofile%5D=subscriptions&page%5Bsize%5D=100`


  while (nextUrl) {
    console.log(`profiles fetched: ${allProfiles.length}`)
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoProfilesResponse = await response.json()
    allProfiles.push(...data.data)

    nextUrl = data.links.next ?? null
  }

  return allProfiles
}

// ── Metrics API ──────────────────────────────────────────────────────

/**
 * Fetches ALL metrics from the Klaviyo account, handling pagination.
 */
export async function getAllMetrics(
  apiKey: string
): Promise<KlaviyoMetric[]> {
  const allMetrics: KlaviyoMetric[] = []
  let nextUrl: string | null = `${KLAVIYO_BASE_URL}/api/metrics`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Metrics API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoMetricsResponse = await response.json()
    allMetrics.push(...data.data)
    nextUrl = data.links.next ?? null
  }

  return allMetrics
}

/**
 * Finds a metric by its exact name and returns its ID.
 * Throws if not found.
 */
export function findMetricIdByName(
  metrics: KlaviyoMetric[],
  name: string
): string {
  const metric = metrics.find(
    (m) => m.attributes.name.toLowerCase() === name.toLowerCase()
  )
  if (!metric) {
    throw new Error(`Metric "${name}" not found in Klaviyo account`)
  }
  return metric.id
}

// ── Segments API ─────────────────────────────────────────────────────

export interface KlaviyoSegment {
  type: "segment"
  id: string
  attributes: {
    name: string
    created: string
    updated: string
    is_active: boolean
    is_processing: boolean
    is_starred: boolean
    profile_count?: number
  }
}

interface KlaviyoSegmentsResponse {
  data: KlaviyoSegment[]
  links: {
    self: string
    next: string | null
  }
}

interface KlaviyoSegmentResponse {
  data: KlaviyoSegment
}

/**
 * Fetches ALL segments from the Klaviyo account, handling pagination.
 */
export async function getAllSegments(
  apiKey: string
): Promise<KlaviyoSegment[]> {
  const allSegments: KlaviyoSegment[] = []
  let nextUrl: string | null = `${KLAVIYO_BASE_URL}/api/segments`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Segments API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoSegmentsResponse = await response.json()
    allSegments.push(...data.data)
    nextUrl = data.links.next ?? null
  }

  return allSegments
}

/**
 * Fetches a single segment with profile_count using additional-fields.
 */
export async function getSegmentProfileCount(
  apiKey: string,
  segmentId: string
): Promise<number> {
  const response = await fetchWithRetry(
    `${KLAVIYO_BASE_URL}/api/segments/${segmentId}?additional-fields[segment]=profile_count`,
    {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Klaviyo Segment API error (${response.status}): ${errorBody}`
    )
  }

  const data: KlaviyoSegmentResponse = await response.json()
  return data.data.attributes.profile_count ?? 0
}

// ── Metric Aggregates API ────────────────────────────────────────────

/**
 * Queries the metric-aggregates endpoint and returns the total count
 * (sum of all values across the date buckets) for a given metric.
 */
export async function queryMetricAggregateCount(
  apiKey: string,
  metricId: string,
  startDate: string,
  endDate: string,
  measurement: MetricMeasurement = "count",
  extraFilters: string[] = [],
  timezone: string = "UTC",
  by: string[] = []
): Promise<number> {
  const attributes: MetricAggregateRequest["data"]["attributes"] = {
    metric_id: metricId,
    measurements: [measurement],
    filter: [
      `greater-or-equal(datetime,${startDate})`,
      `less-than(datetime,${endDate})`,
      ...extraFilters,
    ],
    interval: "month",
    timezone,
  }

  if (by.length > 0) {
    attributes.by = by
  }

  const body: MetricAggregateRequest = {
    data: {
      type: "metric-aggregate",
      attributes,
    },
  }

  const response = await fetchWithRetry(`${KLAVIYO_BASE_URL}/api/metric-aggregates`, {
    method: "POST",
    headers: klaviyoHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Klaviyo Metric Aggregates API error (${response.status}): ${errorBody}`
    )
  }

  const result: MetricAggregateResponse = await response.json()

  let total = 0
  for (const dataPoint of result.data.attributes.data) {
    const values = dataPoint.measurements[measurement] ?? []
    for (const v of values) {
      total += v
    }
  }

  return total
}

/**
 * Queries metric-aggregates grouped by a single dimension key and returns
 * a map of dimension value -> summed measurement across all date buckets.
 */
export async function queryMetricAggregateGroupedSums(
  apiKey: string,
  metricId: string,
  startDate: string,
  endDate: string,
  byKey: string,
  measurement: MetricMeasurement = "sum_value",
  extraFilters: string[] = [],
  timezone: string = "UTC"
): Promise<Record<string, number>> {
  const body: MetricAggregateRequest = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metricId,
        measurements: [measurement],
        filter: [
          `greater-or-equal(datetime,${startDate})`,
          `less-than(datetime,${endDate})`,
          ...extraFilters,
        ],
        interval: "month",
        timezone,
        by: [byKey],
      },
    },
  }

  const response = await fetchWithRetry(`${KLAVIYO_BASE_URL}/api/metric-aggregates`, {
    method: "POST",
    headers: klaviyoHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Klaviyo Metric Aggregates API error (${response.status}): ${errorBody}`
    )
  }

  const result: MetricAggregateResponse = await response.json()
  const groupedTotals: Record<string, number> = {}

  for (const dataPoint of result.data.attributes.data) {
    const dimensionValue = dataPoint.dimensions?.[0] ?? "__unknown__"
    const values = dataPoint.measurements[measurement] ?? []
    const sumForDimension = values.reduce((sum, v) => sum + v, 0)
    groupedTotals[dimensionValue] = (groupedTotals[dimensionValue] ?? 0) + sumForDimension
  }

  return groupedTotals
}

/**
 * Fuzzy-matches a flow name against the flows list.
 * Returns all matching flows (exact first, then contains).
 */
export function findFlowsByName(
  allFlows: KlaviyoFlow[],
  flowName: string
): KlaviyoFlow[] {
  const nameLower = flowName.toLowerCase()

  // Exact matches first
  const exact = allFlows.filter(
    (f) => f.attributes.name.toLowerCase() === nameLower
  )
  if (exact.length > 0) return exact

  // Fallback to contains
  const partial = allFlows.filter(
    (f) => f.attributes.name.toLowerCase().includes(nameLower)
  )
  return partial
}

/**
 * Generic function: queries the metric-aggregates endpoint filtered by
 * one or more flow names. Resolves flow IDs and metric ID from their names.
 * Sums results across all matched flows. Returns the total across all date buckets.
 */
export async function queryMetricAggregateCountByEventAndFlow(
  apiKey: string,
  allMetrics: KlaviyoMetric[],
  allFlows: KlaviyoFlow[],
  metricName: string,
  flowNames: string[],
  startDate: string,
  endDate: string,
  measurement: MetricMeasurement = "count",
  flowAttribute: "$flow" | "$attributed_flow" = "$flow",
  timezone: string = "UTC"
): Promise<number> {
  const metricId = findMetricIdByName(allMetrics, metricName)

  // Resolve all flow names to flows
  const matchedFlows: KlaviyoFlow[] = []
  for (const flowName of flowNames) {
    const found = findFlowsByName(allFlows, flowName)
    if (found.length === 0) {
      console.warn(
        `[klaviyo] Flow "${flowName}" not found. Available flows:`,
        allFlows.map((f) => f.attributes.name)
      )
    } else {
      console.log(
        `[klaviyo] Matched "${flowName}" → ${found.map((f) => `"${f.attributes.name}" (${f.id})`).join(", ")}`
      )
      matchedFlows.push(...found)
    }
  }

  if (matchedFlows.length === 0) return 0

  // Query each matched flow sequentially and sum results
  let grandTotal = 0
  for (const flow of matchedFlows) {
    const body: MetricAggregateRequest = {
      data: {
        type: "metric-aggregate",
        attributes: {
          metric_id: metricId,
          measurements: [measurement],
          filter: [
            `greater-or-equal(datetime,${startDate})`,
            `less-than(datetime,${endDate})`,
            `equals(${flowAttribute},"${flow.id}")`,
          ],
          interval: "month",
          timezone,
        },
      },
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const response = await fetchWithRetry(`${KLAVIYO_BASE_URL}/api/metric-aggregates`, {
      method: "POST",
      headers: klaviyoHeaders(apiKey),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Metric Aggregates API error (${response.status}): ${errorBody}`
      )
    }

    const result: MetricAggregateResponse = await response.json()

    for (const dataPoint of result.data.attributes.data) {
      const values = dataPoint.measurements[measurement] ?? []
      for (const v of values) {
        grandTotal += v
      }
    }
  }

  return grandTotal
}

// ── Forms API ────────────────────────────────────────────────────────

/**
 * Fetches ALL forms from the Klaviyo account, handling pagination.
 */
export async function getAllForms(
  apiKey: string
): Promise<KlaviyoForm[]> {
  const allForms: KlaviyoForm[] = []
  let nextUrl: string | null = `${KLAVIYO_BASE_URL}/api/forms`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Forms API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoFormsResponse = await response.json()
    allForms.push(...data.data)
    nextUrl = data.links.next ?? null
  }

  return allForms
}

/**
 * Queries form submit rate using the Reporting API (POST /api/form-values-reports).
 * Returns aggregated { totalViewed, totalSubmits } across all forms.
 */
export async function queryFormValuesReport(
  apiKey: string,
  timeframeKey: string = "last_12_months"
): Promise<{ totalViewed: number; totalSubmits: number }> {
  const body = {
    data: {
      type: "form-values-report",
      attributes: {
        timeframe: { key: timeframeKey },
        statistics: ["viewed_form", "submits"],
      },
    },
  }

  const response = await fetchWithRetry(`${KLAVIYO_BASE_URL}/api/form-values-reports`, {
    method: "POST",
    headers: klaviyoHeaders(apiKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Klaviyo Form Values Report API error (${response.status}): ${errorBody}`
    )
  }

  const result: FormValuesReportResponse = await response.json()

  let totalViewed = 0
  let totalSubmits = 0

  for (const row of result.data.attributes.results) {
    totalViewed += row.statistics.viewed_form ?? 0
    totalSubmits += row.statistics.submits ?? 0
  }

  return { totalViewed, totalSubmits }
}

// ── Events API ───────────────────────────────────────────────────────

/**
 * Fetches ALL events for a given metric ID in a date range,
 * handling pagination internally.
 * Uses greater-or-equal for sinceDate and optional less-than for beforeDate.
 */
export async function getEventsByMetricId(
  apiKey: string,
  metricId: string,
  sinceDate: string,
  beforeDate?: string
): Promise<KlaviyoEvent[]> {
  const allEvents: KlaviyoEvent[] = []
  const filterParts = [
    `equals(metric_id,"${metricId}")`,
    `greater-or-equal(datetime,${sinceDate})`,
  ]
  if (beforeDate) {
    filterParts.push(`less-than(datetime,${beforeDate})`)
  }
  const filter = filterParts.join(",")
  let nextUrl: string | null =
    `${KLAVIYO_BASE_URL}/api/events?filter=${encodeURIComponent(filter)}`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Events API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoEventsResponse = await response.json()
    allEvents.push(...data.data)

    console.log(`[klaviyo] Fetched ${data.data.length} events (total so far: ${allEvents.length})`)

    nextUrl = data.links.next ?? null
  }

  return allEvents
}

// ── Flows API ────────────────────────────────────────────────────────

/**
 * Fetches flows from Klaviyo with an optional status filter, handling pagination.
 */
export async function getFlows(
  apiKey: string,
  statusFilter?: string
): Promise<KlaviyoFlow[]> {
  const allFlows: KlaviyoFlow[] = []
  let nextUrl: string | null = statusFilter
    ? `${KLAVIYO_BASE_URL}/api/flows?filter=equals(status,"${statusFilter}")`
    : `${KLAVIYO_BASE_URL}/api/flows`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Flows API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoFlowsResponse = await response.json()
    allFlows.push(...data.data)
    nextUrl = data.links.next ?? null
  }

  return allFlows
}

// ── Campaigns API ─────────────────────────────────────────────────────

/**
 * Fetches sent email campaigns from Klaviyo since a given date, handling pagination.
 * Includes both "Sent" and "Variations Sent" (A/B tests) statuses.
 */
export async function getSentCampaigns(
  apiKey: string,
  sinceDate: string
): Promise<KlaviyoCampaign[]> {
  const filter = [
    "equals(messages.channel,'email')",
    "any(status,['Sent'])",
    `greater-or-equal(updated_at,${sinceDate})`,
  ].join(",")

  const allCampaigns: KlaviyoCampaign[] = []
  let nextUrl: string | null =
    `${KLAVIYO_BASE_URL}/api/campaigns?filter=${encodeURIComponent(filter)}`

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Campaigns API error (${response.status}): ${errorBody}`
      )
    }

    const data: KlaviyoCampaignsResponse = await response.json()
    allCampaigns.push(...data.data)
    nextUrl = data.links.next ?? null
  }

  return allCampaigns
}

/**
 * Queries the Campaign Values Reporting API (POST /api/campaign-values-reports).
 * Returns per-campaign results with the requested statistics.
 *
 * Rate limits: Burst 1/s, Steady 2/m, Daily 225/d
 */
export async function queryCampaignValuesReport(
  apiKey: string,
  statistics: CampaignValuesStatistic[],
  timeframeKey: string,
  conversionMetricId: string,
  filterStr?: string
): Promise<CampaignValuesReportResult[]> {
  const body: Record<string, unknown> = {
    data: {
      type: "campaign-values-report",
      attributes: {
        statistics,
        timeframe: { key: timeframeKey },
        conversion_metric_id: conversionMetricId,
      },
    },
  }

  let allResults: CampaignValuesReportResult[] = []
  let url: string | null = `${KLAVIYO_BASE_URL}/api/campaign-values-reports`
  let isFirstRequest = true

  while (url) {
    if (!isFirstRequest) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: klaviyoHeaders(apiKey),
      ...(isFirstRequest ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Campaign Values Report API error (${response.status}): ${errorBody}`
      )
    }

    const result: CampaignValuesReportResponse = await response.json()
    allResults.push(...result.data.attributes.results)
    url = result.links?.next ?? null
    isFirstRequest = false
  }

  return allResults
}

/**
 * Queries the Flow Values Reporting API (POST /api/flow-values-reports).
 * Returns per-flow-message results with the requested statistics.
 * Mirrors the campaign-values-reports pattern.
 */
export async function queryFlowValuesReport(
  apiKey: string,
  statistics: FlowValuesStatistic[],
  timeframeKey: string,
  conversionMetricId: string
): Promise<FlowValuesReportResult[]> {
  const body = {
    data: {
      type: "flow-values-report",
      attributes: {
        statistics,
        timeframe: { key: timeframeKey },
        conversion_metric_id: conversionMetricId,
      },
    },
  }

  let allResults: FlowValuesReportResult[] = []
  let url: string | null = `${KLAVIYO_BASE_URL}/api/flow-values-reports`
  let isFirstRequest = true

  while (url) {
    if (!isFirstRequest) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: klaviyoHeaders(apiKey),
      ...(isFirstRequest ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(
        `Klaviyo Flow Values Report API error (${response.status}): ${errorBody}`
      )
    }

    const result: FlowValuesReportResponse = await response.json()
    allResults.push(...result.data.attributes.results)
    url = result.links?.next ?? null
    isFirstRequest = false
  }

  return allResults
}

// export async function getFlowIdsByName(apiKey: string, names: string[]): Promise<string[]> {
//   const flows = await getFlows(apiKey)
//   return flows.filter(flow => names.includes(flow.attributes.name)).map(flow => flow.id)
// }
// export const getFlowActionsByFlowId = async (apiKey: string, flowId: string): Promise<KlaviyoFlowAction[]> => {
//   const response = await fetch(`${KLAVIYO_BASE_URL}/api/flows/${flowId}/flow-actions`, {
//     method: "GET",
//     headers: klaviyoHeaders(apiKey),
//   })
//   if (!response.ok) {
//     const errorBody = await response.text()
//     throw new Error(
//       `Klaviyo Flow Actions API error (${response.status}): ${errorBody}`
//     )
//   }
//   const data: KlaviyoFlowActionsResponse = await response.json()
//   return data.data
// }
// export const getActionIdsByActionType = (actions: KlaviyoFlowAction[], actionType: string): string[] => {
//   return actions.filter(action => action.attributes.action_type === actionType).map(action => action.id)
// }

// export const getFlowMessagesByActionId = async (apiKey: string, actionId: string): Promise<KlaviyoFlowMessage[]> => {
//   const response = await fetch(`${KLAVIYO_BASE_URL}/api/flow-actions/${actionId}/flow-messages`, {
//     method: "GET",
//     headers: klaviyoHeaders(apiKey),
//   })
//   if (!response.ok) {
//     const errorBody = await response.text()
//     throw new Error(
//       `Klaviyo Flow Messages API error (${response.status}): ${errorBody}`
//     )
//   }
//   const data: KlaviyoFlowMessagesResponse = await response.json()
//   return data.data
// }
// export const convertFlowMessagesToIds = (messages: KlaviyoFlowMessage[]): string[] => messages.map(message => message.id)


// export const getMetricCountByFlowName = async (apiKey: string, flowName: string): Promise<number> => {
//   const actionName = "SEND_EMAIL"
//   const flowIds = await getFlowIdsByName(apiKey, [flowName])
//   const flowActions = (await Promise.all(flowIds.map(async (flowId) => await getFlowActionsByFlowId(apiKey, flowId)))).flat()
//   const actionIds = flowActions.flatMap((actions) => getActionIdsByActionType(flowActions, "SEND_EMAIL"))
//   const flowMessages = (await Promise.all(actionIds.map(async (actionId) => await getFlowMessagesByActionId(apiKey, actionId)))).flat()
//   const messageIds = convertFlowMessagesToIds(flowMessages)




// }
// }