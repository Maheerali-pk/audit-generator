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
 * Generic function: queries the metric-aggregates endpoint filtered by
 * a specific flow. Resolves flow ID and metric ID from their names.
 * Returns the total count across all date buckets.
 */
export async function queryMetricAggregateCountByEventAndFlow(
  apiKey: string,
  allMetrics: KlaviyoMetric[],
  allFlows: KlaviyoFlow[],
  metricName: string,
  flowName: string,
  startDate: string,
  endDate: string,
  measurement: MetricMeasurement = "count",
  flowAttribute: "$flow" | "$attributed_flow" = "$flow"
): Promise<number> {
  const metricId = findMetricIdByName(allMetrics, metricName)

  // Fuzzy match: first try exact, then try contains
  const flowNameLower = flowName.toLowerCase()
  let flow = allFlows.find(
    (f) => f.attributes.name.toLowerCase() === flowNameLower
  )
  if (!flow) {
    flow = allFlows.find(
      (f) => f.attributes.name.toLowerCase().includes(flowNameLower)
    )
  }
  if (!flow) {
    console.warn(
      `[klaviyo] Flow "${flowName}" not found. Available flows:`,
      allFlows.map((f) => f.attributes.name)
    )
    return 0
  }
  console.log(`[klaviyo] Matched flow "${flowName}" → "${flow.attributes.name}" (${flow.id})`)

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

  let total = 0
  for (const dataPoint of result.data.attributes.data) {
    const values = dataPoint.measurements[measurement] ?? []
    for (const v of values) {
      total += v
    }
  }

  return total
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