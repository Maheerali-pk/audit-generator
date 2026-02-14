import type { KlaviyoProfile } from "@/types/klaviyo.types"
import type { KlaviyoForm } from "@/types/forms.types"
import type { KlaviyoEvent } from "@/types/events.types"

/**
 * Returns the count of profiles where email marketing consent is "SUBSCRIBED".
 */
export function getActiveEmailSubscribers(
  profiles: KlaviyoProfile[]
): number {
  return profiles.filter(
    (p) =>
      p.attributes.subscriptions?.email?.marketing?.consent === "SUBSCRIBED"
  ).length
}

/**
 * Returns the percentage of profiles that are suppressed.
 * A profile is suppressed if its suppression array is non-empty.
 */
export function getSuppressedProfilesPercent(
  profiles: KlaviyoProfile[]
): number {
  if (profiles.length === 0) return 0

  const suppressedCount = profiles.filter(
    (p) =>
      p.attributes.subscriptions?.email?.marketing?.suppression != null &&
      p.attributes.subscriptions.email.marketing.suppression.length > 0
  ).length

  return parseFloat(((suppressedCount / profiles.length) * 100).toFixed(2))
}

/**
 * Returns the raw count of suppressed profiles.
 */
export function getSuppressedProfiles(
  profiles: KlaviyoProfile[]
): number {
  return profiles.filter(
    (p) =>
      p.attributes.subscriptions?.email?.marketing?.suppression != null &&
      p.attributes.subscriptions.email.marketing.suppression.length > 0
  ).length
}

/**
 * Returns the count of profiles that subscribed within the last `days` days.
 * A profile qualifies if consent is "SUBSCRIBED" and consent_timestamp is within range.
 */
export function getNewSubscribers(
  profiles: KlaviyoProfile[],
  days: number
): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  return profiles.filter((p) => {
    const marketing = p.attributes.subscriptions?.email?.marketing
    if (marketing?.consent !== "SUBSCRIBED") return false

    const timestamp = marketing.consent_timestamp
    if (!timestamp) return false

    return new Date(timestamp) >= cutoff
  }).length
}

/**
 * Calculates unsubscribe rate = (unsubscribed count / received count) * 100.
 * Both counts come from the Klaviyo metric-aggregates API.
 * Returns a percentage rounded to 2 decimal places, or 0 if no emails received.
 */
export function getUnsubscribeRate(
  unsubscribedCount: number,
  receivedCount: number
): number {
  if (receivedCount === 0) return 0
  return parseFloat(((unsubscribedCount / receivedCount) * 100).toFixed(2))
}

/**
 * Calculates list growth rate = ((new subs - unsubs) / total profiles) * 100.
 * New subs and unsubs come from the metric-aggregates API (last month).
 * Returns a percentage rounded to 2 decimal places.
 */
export function getListGrowthRate(
  newSubsCount: number,
  unsubsCount: number,
  totalProfiles: number
): number {
  if (totalProfiles === 0) return 0
  return parseFloat(
    (((newSubsCount - unsubsCount) / totalProfiles) * 100).toFixed(2)
  )
}

/**
 * Returns the count of forms with status "live".
 */
export function getTotalActiveForms(forms: KlaviyoForm[]): number {
  return forms.filter((f) => f.attributes.status === "live").length
}

/**
 * Calculates form submit rate = (submitted form count / viewed form count) * 100.
 * Both counts come from the Klaviyo metric-aggregates API.
 * Returns a percentage rounded to 2 decimal places.
 */
export function getFormSubmitRate(
  submittedCount: number,
  viewedCount: number
): number {
  if (viewedCount === 0) return 0
  return parseFloat(((submittedCount / viewedCount) * 100).toFixed(2))
}

/**
 * Counts form submission events by device type (desktop vs mobile).
 * device_type is typically "DESKTOP" or "MOBILE".
 */
export function getFormSubmissionsByDevice(
  events: KlaviyoEvent[]
): { desktop: number; mobile: number } {
  let desktop = 0
  let mobile = 0

  for (const event of events) {
    const deviceType = event.attributes.event_properties.device_type?.toUpperCase()
    if (deviceType === "MOBILE") {
      mobile++
    } else {
      desktop++
    }
  }

  return { desktop, mobile }
}
