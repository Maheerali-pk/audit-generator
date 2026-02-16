import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AccountSettings } from "./account-settings"
import type { FlowMappings } from "@/types/custom-config.types"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/signin")
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from("klaviyo_accounts")
    .select("*")
    .eq("id", id)
    .single()

  if (!account) {
    notFound()
  }

  return <AccountSettings account={{ ...account, flow_mappings: account.flow_mappings as FlowMappings | null }} />
}
