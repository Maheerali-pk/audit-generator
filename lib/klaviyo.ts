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
    const response = await fetch(nextUrl, {
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

    // data.links.next is either a full URL for the next page or null
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
    const response = await fetch(nextUrl, {
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
  extraFilters: string[] = []
): Promise<number> {
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
        timezone: "US/Eastern",
      },
    },
  }

  const response = await fetch(`${KLAVIYO_BASE_URL}/api/metric-aggregates`, {
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

  // Sum all values across all date buckets and data points
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
  flowAttribute: "$flow" | "$attributed_flow" = "$flow"
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
          timezone: "US/Eastern",
        },
      },
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    const response = await fetch(`${KLAVIYO_BASE_URL}/api/metric-aggregates`, {
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
    const response = await fetch(nextUrl, {
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

  const response = await fetch(`${KLAVIYO_BASE_URL}/api/form-values-reports`, {
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
 * Fetches ALL events for a given metric ID since a start date,
 * handling pagination internally.
 */
export async function getEventsByMetricId(
  apiKey: string,
  metricId: string,
  sinceDate: string
): Promise<KlaviyoEvent[]> {
  const allEvents: KlaviyoEvent[] = []
  const filter = `equals(metric_id,"${metricId}"),greater-or-equal(datetime,${sinceDate})`
  let nextUrl: string | null =
    `${KLAVIYO_BASE_URL}/api/events?filter=${encodeURIComponent(filter)}`

  while (nextUrl) {
    const response = await fetch(nextUrl, {
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
    const response = await fetch(nextUrl, {
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
    const response = await fetch(nextUrl, {
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
        filter: filterStr ?? "equals(send_channel,\"email\")",
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

    const response = await fetch(url, {
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