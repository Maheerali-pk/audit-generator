import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { decrypt } from "@/lib/encryption"
import {
  getAllProfilesWithSubscriptionData,
  getAllMetrics,
  findMetricIdByName,
  queryMetricAggregateCount,
  queryMetricAggregateCountByEventAndFlow,
  getAllForms,
  queryFormValuesReport,
  getEventsByMetricId,
  getFlows,
} from "@/lib/klaviyo"
import { createEmptyMetrics } from "@/types/audit.types"
import type { Json } from "@/types/database.types"
import type { FlowMappings, FlowMappingEntry } from "@/types/custom-config.types"
import {
  getActiveEmailSubscribers,
  getSuppressedProfilesPercent,
  getSuppressedProfiles,
  getNewSubscribers,
  getUnsubscribeRate,
  getListGrowthRate,
  getTotalActiveForms,
  getFormSubmitRate,
  getFormSubmissionsByDevice,
} from "@/lib/metrics"

export const maxDuration = 300 // Allow up to 5 minutes on Vercel Pro

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()

  // Parse selected sections from request body
  let sections: string[] = []
  try {
    const body = await request.json()
    sections = body.sections ?? []
  } catch {
    sections = ["email_marketing", "popups_forms"] // default: all
  }

  console.log("[audit] Starting audit for account:", id, "sections:", sections)

  // Verify the user is authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get the account from the database
  const { data: account, error: dbError } = await admin
    .from("klaviyo_accounts")
    .select("*")
    .eq("id", id)
    .single()

  if (dbError || !account) {
    console.error("[audit] Account lookup error:", dbError)
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  // Create an in-progress audit report
  const { data: auditReport, error: insertError } = await admin
    .from("audit_reports")
    .insert({
      klaviyo_account_id: id,
      status: "in_progress",
      metrics: createEmptyMetrics() as unknown as Json,
    })
    .select()
    .single()

  if (insertError || !auditReport) {
    console.error("[audit] Insert error:", insertError)
    return NextResponse.json(
      { error: "Failed to create audit report", details: insertError?.message },
      { status: 500 }
    )
  }

  // Decrypt the API key
  let apiKey: string
  try {
    apiKey = decrypt(account.api_key_encrypted)
  } catch (decryptErr) {
    console.error("[audit] Decrypt error:", decryptErr)
    await admin
      .from("audit_reports")
      .update({ status: "failed" })
      .eq("id", auditReport.id)

    return NextResponse.json(
      { error: "Failed to decrypt API key. The key may be corrupted." },
      { status: 500 }
    )
  }

  try {
    const metrics = createEmptyMetrics()

    // Fetch Klaviyo metrics list once (shared across sections that need aggregates)
    const needsMetricsList =
      sections.includes("email_marketing") || sections.includes("popups_forms")
    const allKlaviyoMetrics = needsMetricsList
      ? await getAllMetrics(apiKey)
      : null

    // ── Email Marketing section ──────────────────────────────────
    if (sections.includes("email_marketing")) {
      console.log("[audit] Running Email Marketing section...")

      // Fetch all profiles with subscription data
      const profiles = await getAllProfilesWithSubscriptionData(apiKey)

      // Profile-based metrics
      metrics.total_profiles = profiles.length
      metrics.active_email_subscribers = getActiveEmailSubscribers(profiles)
      metrics.suppressed_profiles = getSuppressedProfiles(profiles)
      metrics.suppressed_profiles_pct = getSuppressedProfilesPercent(profiles)
      metrics.new_subscribers_30d = getNewSubscribers(profiles, 30)
      metrics.new_subscribers_90d = getNewSubscribers(profiles, 90)

      // Metric-aggregate-based metrics
      const unsubscribedMetricId = findMetricIdByName(
        allKlaviyoMetrics!,
        "Unsubscribed from Email Marketing"
      )
      const receivedMetricId = findMetricIdByName(
        allKlaviyoMetrics!,
        "Received Email"
      )
      const subscribedMetricId = findMetricIdByName(
        allKlaviyoMetrics!,
        "Subscribed to Email Marketing"
      )

      console.log(
        "[audit] Metric IDs — Unsubscribed:", unsubscribedMetricId,
        "Received:", receivedMetricId,
        "Subscribed:", subscribedMetricId
      )

      // Date ranges
      const now = new Date()
      const oneYearAgo = new Date()
      oneYearAgo.setDate(now.getDate() - 365)
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(now.getMonth() - 1)

      const start1y = oneYearAgo.toISOString().split("T")[0] + "T00:00:00"
      const start1m = oneMonthAgo.toISOString().split("T")[0] + "T00:00:00"
      const endDate = now.toISOString().split("T")[0] + "T00:00:00"

      // Run aggregate queries sequentially (Klaviyo rate limit: 3/s)
      const unsubscribedCount1y = await queryMetricAggregateCount(apiKey, unsubscribedMetricId, start1y, endDate)
      const receivedCount1y = await queryMetricAggregateCount(apiKey, receivedMetricId, start1y, endDate)
      const subscribedCount1m = await queryMetricAggregateCount(apiKey, subscribedMetricId, start1m, endDate)
      const unsubscribedCount1m = await queryMetricAggregateCount(apiKey, unsubscribedMetricId, start1m, endDate)

      console.log("[audit] 1y — Unsubscribed:", unsubscribedCount1y, "Received:", receivedCount1y)
      console.log("[audit] 1m  — Subscribed:", subscribedCount1m, "Unsubscribed:", unsubscribedCount1m)

      metrics.unsubscribe_rate = getUnsubscribeRate(unsubscribedCount1y, receivedCount1y)
      metrics.list_growth_rate = getListGrowthRate(
        subscribedCount1m,
        unsubscribedCount1m,
        metrics.total_profiles
      )
    }

    // ── Popups & Forms section ───────────────────────────────────
    if (sections.includes("popups_forms")) {
      console.log("[audit] Running Popups & Forms section...")
      const allForms = await getAllForms(apiKey)
      metrics.total_active_forms = getTotalActiveForms(allForms)
      console.log("[audit] Total active forms:", metrics.total_active_forms)

      // Form submit rate via Reporting API (works even if "Submitted Form" metric doesn't exist)
      const { totalViewed, totalSubmits } = await queryFormValuesReport(apiKey, "last_30_days")
      console.log("[audit] Form Values Report — Viewed:", totalViewed, "Submits:", totalSubmits)
      metrics.form_submit_rate = getFormSubmitRate(totalSubmits, totalViewed)
      metrics.email_capture_count_30d = totalSubmits

      // Date range for remaining popups/forms metrics
      const now1m = new Date()
      const oneMonthAgoForms = new Date()
      oneMonthAgoForms.setMonth(now1m.getMonth() - 1)
      const formStart = oneMonthAgoForms.toISOString().split("T")[0] + "T00:00:00"
      const formEnd = now1m.toISOString().split("T")[0] + "T00:00:00"

      // SMS capture count (30d)
      const smsSubscribedMetricId = findMetricIdByName(allKlaviyoMetrics!, "Subscribed to SMS Marketing")
      console.log("[audit] Metric ID — Subscribed to SMS Marketing:", smsSubscribedMetricId)
      metrics.sms_capture_count_30d = await queryMetricAggregateCount(apiKey, smsSubscribedMetricId, formStart, formEnd)
      console.log("[audit] 1m — SMS Capture Count:", metrics.sms_capture_count_30d)

      // Email vs SMS capture ratio
      metrics.email_vs_sms_capture_ratio =
        metrics.sms_capture_count_30d > 0
          ? parseFloat((totalSubmits / metrics.sms_capture_count_30d).toFixed(2))
          : null
      console.log("[audit] Email vs SMS Capture Ratio:", metrics.email_vs_sms_capture_ratio)

      // Form submissions by device (last 30 days) — needs "Submitted Form" metric for events API
      try {
        const submittedFormMetricId = findMetricIdByName(allKlaviyoMetrics!, "Submitted Form")
        console.log("[audit] Fetching Submitted Form events for device breakdown...")
        const formEvents = await getEventsByMetricId(apiKey, submittedFormMetricId, formStart)
        const { desktop, mobile } = getFormSubmissionsByDevice(formEvents)
        const totalSubmissions = desktop + mobile
        metrics.form_submissions_desktop = totalSubmissions > 0
          ? parseFloat(((desktop / totalSubmissions) * 100).toFixed(2))
          : 0
        metrics.form_submissions_mobile = totalSubmissions > 0
          ? parseFloat(((mobile / totalSubmissions) * 100).toFixed(2))
          : 0
        console.log("[audit] Form submissions — Desktop:", metrics.form_submissions_desktop + "%", "Mobile:", metrics.form_submissions_mobile + "%")
      } catch (err) {
        console.warn("[audit] Skipping device breakdown — 'Submitted Form' metric not found:", err instanceof Error ? err.message : err)
      }
    }

    // ── Flows section ────────────────────────────────────────────
    if (sections.includes("flows")) {
      console.log("[audit] Running Flows section...")
      const activeFlows = await getFlows(apiKey, "live")
      metrics.total_active_flows = activeFlows.length
      console.log("[audit] Total active flows:", metrics.total_active_flows)

      const draftFlows = await getFlows(apiKey, "draft")
      const manualFlows = await getFlows(apiKey, "manual")
      metrics.total_inactive_draft_flows = draftFlows.length + manualFlows.length
      console.log("[audit] Total inactive/draft flows:", metrics.total_inactive_draft_flows)

      // Welcome Flow — Open Rate (Opened Email / Received Email for Welcome flow)
      const allFlows = [...activeFlows, ...draftFlows, ...manualFlows]
      const flowMetricsList = allKlaviyoMetrics ?? await getAllMetrics(apiKey)

      const now90d = new Date()
      const ninetyDaysAgoFlow = new Date()
      ninetyDaysAgoFlow.setDate(now90d.getDate() - 90)
      const flowStart = ninetyDaysAgoFlow.toISOString().split("T")[0] + "T00:00:00"
      const flowEnd = now90d.toISOString().split("T")[0] + "T00:00:00"

      // Read flow mappings from account settings
      const fm = account.flow_mappings as FlowMappings | null
      const getFlowNames = (category: keyof FlowMappings): string[] => {
        const entries = fm?.[category] as FlowMappingEntry[] | undefined
        if (!entries || entries.length === 0) return []
        return entries.map((e) => e.flow_name)
      }

      console.log("[audit] Flow mappings from account:", JSON.stringify(fm))

      // Helper to compute open/click rates for one or more flows (aggregated)
      const computeFlowRate = async (
        flowNames: string[],
        eventName: string
      ): Promise<number | null> => {
        if (flowNames.length === 0) return null
        const eventCount = await queryMetricAggregateCountByEventAndFlow(
          apiKey, flowMetricsList, allFlows, eventName, flowNames, flowStart, flowEnd
        )
        const receivedCount = await queryMetricAggregateCountByEventAndFlow(
          apiKey, flowMetricsList, allFlows, "Received Email", flowNames, flowStart, flowEnd
        )
        const label = flowNames.join(" | ")
        console.log(`[audit] ${label} — ${eventName}:`, eventCount, "Received:", receivedCount)
        return receivedCount > 0
          ? parseFloat(((eventCount / receivedCount) * 100).toFixed(2))
          : null
      }

      // Welcome Flow
      const welcomeFlowNames = getFlowNames("welcome")
      metrics.welcome_flow_open_rate = await computeFlowRate(welcomeFlowNames, "Opened Email")
      metrics.welcome_flow_click_rate = await computeFlowRate(welcomeFlowNames, "Clicked Email")

      // Welcome Flow — Revenue (Placed Order attributed to Welcome flow)
      if (welcomeFlowNames.length > 0) {
        metrics.welcome_flow_revenue = await queryMetricAggregateCountByEventAndFlow(
          apiKey, flowMetricsList, allFlows, "Placed Order", welcomeFlowNames,
          flowStart, flowEnd, "sum_value", "$attributed_flow"
        )
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("[audit] Welcome Flow — Revenue:", metrics.welcome_flow_revenue)

      // Abandoned Cart Flow
      const acFlowNames = getFlowNames("abandoned_cart")
      metrics.abandoned_cart_open_rate = await computeFlowRate(acFlowNames, "Opened Email")
      metrics.abandoned_cart_click_rate = await computeFlowRate(acFlowNames, "Clicked Email")

      // Abandoned Cart — Recovery Rate (Placed Order by AC / Received Email for AC)
      if (acFlowNames.length > 0) {
        const acPlacedOrders = await queryMetricAggregateCountByEventAndFlow(
          apiKey, flowMetricsList, allFlows, "Placed Order", acFlowNames,
          flowStart, flowEnd, "count", "$attributed_flow"
        )
        const acReceived = await queryMetricAggregateCountByEventAndFlow(
          apiKey, flowMetricsList, allFlows, "Received Email", acFlowNames,
          flowStart, flowEnd, "count", "$flow"
        )
        console.log("[audit] Abandoned Cart — Placed Orders:", acPlacedOrders, "Received:", acReceived)
        metrics.abandoned_cart_recovery_rate = acReceived > 0
          ? parseFloat(((acPlacedOrders / acReceived) * 100).toFixed(2))
          : null
      }

      // Browse Abandonment Flow
      const browseFlowNames = getFlowNames("browse_abandonment")
      metrics.browse_abandonment_open_rate = await computeFlowRate(browseFlowNames, "Opened Email")
      metrics.browse_abandonment_click_rate = await computeFlowRate(browseFlowNames, "Clicked Email")

      // Post-Purchase Flow
      const postPurchaseFlowNames = getFlowNames("post_purchase")
      metrics.post_purchase_open_rate = await computeFlowRate(postPurchaseFlowNames, "Opened Email")
      metrics.post_purchase_click_rate = await computeFlowRate(postPurchaseFlowNames, "Clicked Email")

      // Winback Flow
      const winbackFlowNames = getFlowNames("winback")
      metrics.winback_open_rate = await computeFlowRate(winbackFlowNames, "Opened Email")
      metrics.winback_click_rate = await computeFlowRate(winbackFlowNames, "Clicked Email")

      // Flow Revenue as % of Total Email Revenue
      const placedOrderMetricId = findMetricIdByName(flowMetricsList, "Placed Order")
      console.log("[audit] Metric ID — Placed Order:", placedOrderMetricId)

      // Total email Placed Order revenue (no flow filter)
      const totalEmailRevenue = await queryMetricAggregateCount(
        apiKey, placedOrderMetricId, flowStart, flowEnd, "sum_value"
      )
      // Non-flow revenue (attributed_flow is empty)
      const nonFlowRevenue = await queryMetricAggregateCount(
        apiKey, placedOrderMetricId, flowStart, flowEnd, "sum_value",
        ['equals($attributed_flow,"")']
      )

      const flowRevenue = totalEmailRevenue - nonFlowRevenue
      console.log("[audit] Revenue — Total:", totalEmailRevenue, "Non-flow:", nonFlowRevenue, "Flow:", flowRevenue)

      metrics.flow_revenue_pct_of_total = totalEmailRevenue > 0
        ? parseFloat(((flowRevenue / totalEmailRevenue) * 100).toFixed(2))
        : null
    }

    const runtimeSeconds = Math.round((Date.now() - startTime) / 1000)

    // Update the audit report with computed metrics
    const { data: completedReport, error: updateError } = await admin
      .from("audit_reports")
      .update({
        status: "completed",
        metrics: metrics as unknown as Json,
        runtime_seconds: runtimeSeconds,
      })
      .eq("id", auditReport.id)
      .select()
      .single()

    if (updateError) {
      console.error("[audit] Update error:", updateError)
      console.error("[audit] Attempted update for report id:", auditReport.id)
      console.error("[audit] Metrics payload:", JSON.stringify(metrics).slice(0, 500))
      return NextResponse.json(
        { error: "Failed to save audit report", details: updateError.message },
        { status: 500 }
      )
    }

    console.log("[audit] Report saved successfully:", completedReport.id)

    // Update last_audit_at on the account
    await admin
      .from("klaviyo_accounts")
      .update({ last_audit_at: new Date().toISOString() })
      .eq("id", id)

    return NextResponse.json(completedReport)
  } catch (err: unknown) {
    console.error("[audit] Klaviyo/metrics error:", err)
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch profiles from Klaviyo"

    await admin
      .from("audit_reports")
      .update({ status: "failed" })
      .eq("id", auditReport.id)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Verify the user is authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get the latest audit report for this account
  const admin = createAdminClient()
  const { data: report, error } = await admin
    .from("audit_reports")
    .select("*")
    .eq("klaviyo_account_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !report) {
    return NextResponse.json(null)
  }

  return NextResponse.json(report)
}
