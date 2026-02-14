import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AccountDetail } from "./account-detail"

export default async function AccountPage({
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

  return <AccountDetail account={account} />
}
