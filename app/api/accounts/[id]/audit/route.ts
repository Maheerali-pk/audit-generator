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
  getSentCampaigns,
  queryCampaignValuesReport,
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
    sections = ["email_marketing", "popups_forms", "campaigns", "technical_health"] // default: all
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
      sections.includes("email_marketing") || sections.includes("popups_forms") || sections.includes("campaigns") || sections.includes("technical_health")
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


      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("[audit] Welcome Flow — Revenue:", metrics.welcome_flow_revenue)

      // Abandoned Cart Flow
      const acFlowNames = getFlowNames("abandoned_cart")
      metrics.abandoned_cart_open_rate = await computeFlowRate(acFlowNames, "Opened Email")
      metrics.abandoned_cart_click_rate = await computeFlowRate(acFlowNames, "Clicked Email")
      await new Promise(resolve => setTimeout(resolve, 1000));

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

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Browse Abandonment Flow
      const browseFlowNames = getFlowNames("browse_abandonment")
      metrics.browse_abandonment_open_rate = await computeFlowRate(browseFlowNames, "Opened Email")
      metrics.browse_abandonment_click_rate = await computeFlowRate(browseFlowNames, "Clicked Email")

      await new Promise(resolve => setTimeout(resolve, 1000));
      // Post-Purchase Flow
      const postPurchaseFlowNames = getFlowNames("post_purchase")
      metrics.post_purchase_open_rate = await computeFlowRate(postPurchaseFlowNames, "Opened Email")
      metrics.post_purchase_click_rate = await computeFlowRate(postPurchaseFlowNames, "Clicked Email")

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Winback Flow
      const winbackFlowNames = getFlowNames("winback")
      metrics.winback_open_rate = await computeFlowRate(winbackFlowNames, "Opened Email")
      metrics.winback_click_rate = await computeFlowRate(winbackFlowNames, "Clicked Email")

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Flow Revenue as % of Total Email Revenue
      const placedOrderMetricId = findMetricIdByName(flowMetricsList, "Placed Order")
      console.log("[audit] Metric ID — Placed Order:", placedOrderMetricId)

      // Total email Placed Order revenue (no flow filter)
      const totalEmailRevenue = await queryMetricAggregateCount(
        apiKey, placedOrderMetricId, flowStart, flowEnd, "sum_value"
      )
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Non-flow revenue (attributed_flow is empty)
      const nonFlowRevenue = await queryMetricAggregateCount(
        apiKey, placedOrderMetricId, flowStart, flowEnd, "sum_value",
        ['equals($attributed_flow,"")']
      )
      await new Promise(resolve => setTimeout(resolve, 1000));


      const flowRevenue = totalEmailRevenue - nonFlowRevenue
      console.log("[audit] Revenue — Total:", totalEmailRevenue, "Non-flow:", nonFlowRevenue, "Flow:", flowRevenue)

      metrics.flow_revenue_pct_of_total = totalEmailRevenue > 0
        ? parseFloat(((flowRevenue / totalEmailRevenue) * 100).toFixed(2))
        : null
    }

    // ── Campaigns section ─────────────────────────────────────────
    if (sections.includes("campaigns")) {
      console.log("[audit] Running Campaigns section...")

      // Fetch campaigns sent in last 90 days (superset of 30d)
      const now = new Date()
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(now.getDate() - 90)
      const since90d = ninetyDaysAgo.toISOString().split("T")[0]

      const campaigns = await getSentCampaigns(apiKey, since90d)
      console.log("[audit] Total campaigns fetched (90d window):", campaigns.length)

      // Filter precisely using send_time
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(now.getDate() - 30)

      const sentIn90d = campaigns.filter((c) => c.attributes.send_time != null)
      const sentIn30d = sentIn90d.filter(
        (c) => new Date(c.attributes.send_time!) >= thirtyDaysAgo
      )

      metrics.total_campaigns_sent_30d = sentIn30d.length
      metrics.total_campaigns_sent_90d = sentIn90d.length

      console.log("[audit] Campaigns sent — 30d:", metrics.total_campaigns_sent_30d, "90d:", metrics.total_campaigns_sent_90d)

      // Campaign performance metrics via Reporting API (Campaign Values)
      const campaignMetricsList = allKlaviyoMetrics ?? await getAllMetrics(apiKey)
      const placedOrderId = findMetricIdByName(campaignMetricsList, "Placed Order")

      // 90d call — get rates + revenue in a single request
      const results90d = await queryCampaignValuesReport(
        apiKey,
        ["open_rate", "click_rate", "unsubscribe_rate", "bounce_rate", "conversion_value"],
        "last_90_days",
        placedOrderId
      )
      console.log("[audit] Campaign Values Report (90d) — campaigns returned:", results90d.length)

      if (results90d.length > 0) {
        // Average rates across all campaigns (API returns fractional [0, 1])
        const avgOpenRate = results90d.reduce((sum, r) => sum + (r.statistics.open_rate ?? 0), 0) / results90d.length
        const avgClickRate = results90d.reduce((sum, r) => sum + (r.statistics.click_rate ?? 0), 0) / results90d.length
        const avgUnsubRate = results90d.reduce((sum, r) => sum + (r.statistics.unsubscribe_rate ?? 0), 0) / results90d.length
        const avgBounceRate = results90d.reduce((sum, r) => sum + (r.statistics.bounce_rate ?? 0), 0) / results90d.length

        metrics.avg_campaign_open_rate = parseFloat((avgOpenRate * 100).toFixed(2))
        metrics.avg_campaign_click_rate = parseFloat((avgClickRate * 100).toFixed(2))
        metrics.avg_campaign_unsubscribe_rate = parseFloat((avgUnsubRate * 100).toFixed(2))
        metrics.avg_campaign_bounce_rate = parseFloat((avgBounceRate * 100).toFixed(2))

        // 90d revenue — sum across all campaigns
        metrics.campaign_revenue_90d = parseFloat(
          results90d.reduce((sum, r) => sum + (r.statistics.conversion_value ?? 0), 0).toFixed(2)
        )

        console.log("[audit] Campaign Avg Open Rate:", metrics.avg_campaign_open_rate + "%")
        console.log("[audit] Campaign Avg Click Rate:", metrics.avg_campaign_click_rate + "%")
        console.log("[audit] Campaign Avg Unsubscribe Rate:", metrics.avg_campaign_unsubscribe_rate + "%")
        console.log("[audit] Campaign Avg Open Rate:", metrics.avg_campaign_open_rate + "%")
        console.log("[audit] Campaign Avg Click Rate:", metrics.avg_campaign_click_rate + "%")
        console.log("[audit] Campaign Avg Unsubscribe Rate:", metrics.avg_campaign_unsubscribe_rate + "%")
        console.log("[audit] Campaign Avg Bounce Rate:", metrics.avg_campaign_bounce_rate + "%")
        console.log("[audit] Campaign Revenue (90d):", metrics.campaign_revenue_90d)
      }

      // Respect burst rate limit (1/s) before next reporting call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 30d call — revenue + recipients
      const results30d = await queryCampaignValuesReport(
        apiKey,
        ["conversion_value", "recipients", "open_rate"],
        "last_30_days",
        placedOrderId
      )
      console.log("[audit] Campaign Values Report (30d) — campaigns returned:", results30d.length)

      metrics.campaign_revenue_30d = parseFloat(
        results30d.reduce((sum, r) => sum + (r.statistics.conversion_value ?? 0), 0).toFixed(2)
      )

      // Revenue per recipient (avg) — total 30d revenue / total 30d recipients
      const totalRecipients30d = results30d.reduce((sum, r) => sum + (r.statistics.recipients ?? 0), 0)
      metrics.revenue_per_recipient_avg = totalRecipients30d > 0
        ? parseFloat((metrics.campaign_revenue_30d / totalRecipients30d).toFixed(4))
        : null

      // Top campaign by revenue (30d)
      if (results30d.length > 0) {
        const topResult = results30d.reduce((best, r) =>
          (r.statistics.conversion_value ?? 0) > (best.statistics.conversion_value ?? 0) ? r : best
        )
        const topCampaignId = topResult.groupings.campaign_id
        const topCampaign = campaigns.find((c) => c.id === topCampaignId)

        metrics.top_campaign_by_revenue_name = topCampaign?.attributes.name ?? topCampaignId
        metrics.top_campaign_by_revenue_value = parseFloat(
          (topResult.statistics.conversion_value ?? 0).toFixed(2)
        )
        console.log("[audit] Top Campaign by Revenue (30d):", metrics.top_campaign_by_revenue_name, "—", metrics.top_campaign_by_revenue_value)
      }

      // Bottom campaign by open rate (30d)
      if (results30d.length > 0) {
        const bottomResult = results30d.reduce((worst, r) =>
          (r.statistics.open_rate ?? 1) < (worst.statistics.open_rate ?? 1) ? r : worst
        )
        const bottomCampaignId = bottomResult.groupings.campaign_id
        const bottomCampaign = campaigns.find((c) => c.id === bottomCampaignId)

        metrics.bottom_campaign_by_open_rate_name = bottomCampaign?.attributes.name ?? bottomCampaignId
        metrics.bottom_campaign_by_open_rate_value = parseFloat(
          ((bottomResult.statistics.open_rate ?? 0) * 100).toFixed(2)
        )
        console.log("[audit] Bottom Campaign by Open Rate (30d):", metrics.bottom_campaign_by_open_rate_name, "—", metrics.bottom_campaign_by_open_rate_value + "%")
      }

      console.log("[audit] Campaign Revenue (30d):", metrics.campaign_revenue_30d)
      console.log("[audit] Revenue Per Recipient (Avg, 30d):", metrics.revenue_per_recipient_avg)

      // Campaign revenue as % of total email revenue (90d)
      const campaignMetrics = allKlaviyoMetrics ?? await getAllMetrics(apiKey)
      const placedOrderMetricId = findMetricIdByName(campaignMetrics, "Placed Order")

      const now90d = new Date()
      const ninetyDaysAgoCamp = new Date()
      ninetyDaysAgoCamp.setDate(now90d.getDate() - 90)
      const campStart = ninetyDaysAgoCamp.toISOString().split("T")[0] + "T00:00:00"
      const campEnd = now90d.toISOString().split("T")[0] + "T00:00:00"

      const totalEmailRevenue = await queryMetricAggregateCount(
        apiKey, placedOrderMetricId, campStart, campEnd, "sum_value",
        ['not(equals($attributed_message,""))']
      )
      console.log("[audit] Total Email Revenue (90d):", totalEmailRevenue)

      metrics.campaign_revenue_pct_of_total = totalEmailRevenue > 0
        ? parseFloat(((metrics.campaign_revenue_90d! / totalEmailRevenue) * 100).toFixed(2))
        : null
      console.log("[audit] Campaign Revenue as % of Total Email Revenue:", metrics.campaign_revenue_pct_of_total)
    }

    // ── Technical Health section ──────────────────────────────────
    if (sections.includes("technical_health")) {
      console.log("[audit] Running Technical Health section...")

      const thMetrics = allKlaviyoMetrics ?? await getAllMetrics(apiKey)

      // Resolve metric IDs
      const bouncedMetricId = findMetricIdByName(thMetrics, "Bounced Email")
      const receivedMetricId = findMetricIdByName(thMetrics, "Received Email")
      const spamMetricId = findMetricIdByName(thMetrics, "Marked Email as Spam")
      const openedMetricId = findMetricIdByName(thMetrics, "Opened Email")

      console.log("[audit] Technical Health metric IDs — Bounced:", bouncedMetricId, "Received:", receivedMetricId, "Spam:", spamMetricId, "Opened:", openedMetricId)

      // Date range (90d window)
      const now = new Date()
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(now.getDate() - 90)

      const start90d = ninetyDaysAgo.toISOString().split("T")[0] + "T00:00:00"
      const endDate = now.toISOString().split("T")[0] + "T00:00:00"

      const bouncedCount = await queryMetricAggregateCount(apiKey, bouncedMetricId, start90d, endDate)
      const receivedCount = await queryMetricAggregateCount(apiKey, receivedMetricId, start90d, endDate)
      const spamCount = await queryMetricAggregateCount(apiKey, spamMetricId, start90d, endDate)
      const openedCount = await queryMetricAggregateCount(apiKey, openedMetricId, start90d, endDate)

      console.log("[audit] 90d — Bounced:", bouncedCount, "Received:", receivedCount, "Spam:", spamCount, "Opened:", openedCount)

      // Overall Bounce Rate = Bounced / Received * 100
      metrics.overall_bounce_rate = receivedCount > 0
        ? parseFloat(((bouncedCount / receivedCount) * 100).toFixed(2))
        : null

      // Spam Complaint Rate = Marked as Spam / Received * 100
      metrics.spam_complaint_rate = receivedCount > 0
        ? parseFloat(((spamCount / receivedCount) * 100).toFixed(4))
        : null

      // Overall Open Rate = Opened / Received * 100
      metrics.overall_open_rate = receivedCount > 0
        ? parseFloat(((openedCount / receivedCount) * 100).toFixed(2))
        : null

      // Email Deliverability Rate = Received / (Received + Bounced) * 100
      const totalSent = receivedCount + bouncedCount
      metrics.email_deliverability_rate = totalSent > 0
        ? parseFloat(((receivedCount / totalSent) * 100).toFixed(2))
        : null

      // Integration Active? — check for recent "Placed Order" events (last 7 days)
      // Also compute email revenue (30d & 90d) if Placed Order metric exists
      try {
        const placedOrderMetricId = findMetricIdByName(thMetrics, "Placed Order")
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        const start7d = sevenDaysAgo.toISOString().split("T")[0] + "T00:00:00"

        const recentOrderCount = await queryMetricAggregateCount(apiKey, placedOrderMetricId, start7d, endDate)
        metrics.integration_active = recentOrderCount > 0
        console.log("[audit] Integration Active:", metrics.integration_active, "(recent Placed Orders in 7d:", recentOrderCount + ")")

        // Total Email Revenue (30d) — Placed Order $ attributed to email
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        const start30d = thirtyDaysAgo.toISOString().split("T")[0] + "T00:00:00"

        const emailRevenue30d = await queryMetricAggregateCount(
          apiKey, placedOrderMetricId, start30d, endDate, "sum_value",
          ['not(equals($attributed_message,""))']
        )
        metrics.total_email_revenue_30d = parseFloat(emailRevenue30d.toFixed(2))
        console.log("[audit] Total Email Revenue (30d):", metrics.total_email_revenue_30d)

        // Total Email Revenue (90d) — Placed Order $ attributed to email
        const emailRevenue90d = await queryMetricAggregateCount(
          apiKey, placedOrderMetricId, start90d, endDate, "sum_value",
          ['not(equals($attributed_message,""))']
        )
        metrics.total_email_revenue_90d = parseFloat(emailRevenue90d.toFixed(2))
        console.log("[audit] Total Email Revenue (90d):", metrics.total_email_revenue_90d)
      } catch {
        metrics.integration_active = false
        console.log("[audit] Integration Active: false (Placed Order metric not found)")
      }

      console.log("[audit] Overall Bounce Rate:", metrics.overall_bounce_rate + "%")
      console.log("[audit] Spam Complaint Rate:", metrics.spam_complaint_rate + "%")
      console.log("[audit] Overall Open Rate:", metrics.overall_open_rate + "%")
      console.log("[audit] Email Deliverability Rate:", metrics.email_deliverability_rate + "%")
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
