import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { decrypt } from "@/lib/encryption"
import { getFlows } from "@/lib/klaviyo"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: account, error: dbError } = await admin
    .from("klaviyo_accounts")
    .select("*")
    .eq("id", id)
    .single()

  if (dbError || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(account.api_key_encrypted)
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt API key" },
      { status: 500 }
    )
  }

  try {
    // Fetch all flows (no status filter — we want all for the mapping UI)
    const flows = await getFlows(apiKey)
    const simplified = flows.map((f) => ({
      id: f.id,
      name: f.attributes.name,
      status: f.attributes.status,
    }))
    return NextResponse.json(simplified)
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch flows"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
