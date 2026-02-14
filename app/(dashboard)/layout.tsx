import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/signin")
  }

  // Use admin client to bypass RLS for fetching accounts
  const admin = createAdminClient()
  const { data: accounts } = await admin
    .from("klaviyo_accounts")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="flex h-screen bg-background">
      <Sidebar accounts={accounts || []} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={{
            email: user.email,
            user_metadata: user.user_metadata as Record<string, string>,
          }}
        />
        <main className="flex-1 overflow-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
