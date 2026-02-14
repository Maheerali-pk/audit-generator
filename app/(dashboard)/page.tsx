import { Building2 } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Building2 className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Select an account</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Choose a Klaviyo account from the sidebar to view its details and
            generate audit reports.
          </p>
        </div>
      </div>
    </div>
  )
}
