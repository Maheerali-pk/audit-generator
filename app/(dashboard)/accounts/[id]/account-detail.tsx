"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Pencil,
  Trash2,
  Building2,
  Loader2,
  Settings,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AccountFormDialog } from "@/components/dashboard/account-form-dialog"
import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog"
import { toast } from "sonner"
import {
  AUDIT_METRIC_META,
  AUDIT_SECTIONS,
  formatMetricValue,
} from "@/lib/constants"
import type { AuditMetrics } from "@/types/audit.types"

type KlaviyoAccount = {
  id: string
  client_name: string
  api_key_encrypted: string
  created_at: string | null
  last_audit_at: string | null
  last_used_at: string | null
  updated_at: string | null
}

interface AuditReportRow {
  id: string
  klaviyo_account_id: string
  status: string | null
  created_at: string | null
  metrics: AuditMetrics | null
  runtime_seconds: number | null
}

function formatDate(date: string | null): string {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AccountDetail({ account }: { account: KlaviyoAccount }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Section selection state — all enabled by default
  const [selectedSections, setSelectedSections] = useState<string[]>(
    AUDIT_SECTIONS.map((s) => s.id)
  )

  // Audit state
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditReport, setAuditReport] = useState<AuditReportRow | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Load existing audit report on mount
  useEffect(() => {
    async function loadExistingAudit() {
      try {
        const res = await fetch(`/api/accounts/${account.id}/audit`)
        if (res.ok) {
          const data = await res.json()
          if (data) setAuditReport(data)
        }
      } catch {
        // Silently ignore — no existing audit
      } finally {
        setLoadingExisting(false)
      }
    }
    loadExistingAudit()
  }, [account.id])

  const handleGenerateAudit = async () => {
    if (selectedSections.length === 0) {
      toast.error("Please select at least one section")
      return
    }

    setAuditLoading(true)
    setAuditError(null)

    try {
      const res = await fetch(`/api/accounts/${account.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: selectedSections }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to generate audit report")
      }

      const data = await res.json()
      setAuditReport(data)
      toast.success("Audit report generated successfully")
      router.refresh()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong"
      setAuditError(message)
      toast.error(message)
    } finally {
      setAuditLoading(false)
    }
  }

  // Collapsible section state — all expanded by default
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const toggleCollapse = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Get the computed (non-null) metrics for display
  const computedMetrics: {
    key: string
    label: string
    value: string
    section: string
  }[] = []

  if (auditReport?.metrics) {
    const metrics = auditReport.metrics
    for (const [key, meta] of Object.entries(AUDIT_METRIC_META)) {
      const value = metrics[key as keyof AuditMetrics]
      if (value !== null && value !== undefined) {
        computedMetrics.push({
          key,
          label: meta.label,
          value: formatMetricValue(value, meta.format),
          section: meta.section,
        })
      }
    }
  }

  const sections = [...new Set(computedMetrics.map((m) => m.section))]

  return (
    <div className="space-y-3 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">
              {account.client_name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Last audit: {formatDate(account.last_audit_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/accounts/${account.id}/settings`}>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Generate Audit — compact inline */}
      <div className="flex flex-wrap items-center gap-2">
        {AUDIT_SECTIONS.map((section) => (
          <label
            key={section.id}
            className="flex items-center gap-1.5 rounded-md border px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors text-xs"
          >
            <Checkbox
              checked={selectedSections.includes(section.id)}
              onCheckedChange={() => toggleSection(section.id)}
              className="h-3.5 w-3.5"
            />
            <span className="font-medium">{section.label}</span>
          </label>
        ))}
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs px-3"
          onClick={handleGenerateAudit}
          disabled={auditLoading || selectedSections.length === 0}
        >
          {auditLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <BarChart3 className="h-3 w-3" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Audit Error */}
      {auditError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {auditError}
        </div>
      )}

      {/* Audit Results */}
      {loadingExisting ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading previous audit...
        </div>
      ) : auditReport && computedMetrics.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* Table header row */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Audit Results
              </span>
              <div className="flex items-center gap-2">
                {auditReport.runtime_seconds && (
                  <span className="text-[11px] text-muted-foreground">
                    {auditReport.runtime_seconds}s
                  </span>
                )}
                <Badge
                  variant={
                    auditReport.status === "completed"
                      ? "secondary"
                      : "destructive"
                  }
                  className="text-[10px] h-5 px-1.5"
                >
                  {auditReport.status}
                </Badge>
              </div>
            </div>

            {/* Section groups */}
            {sections.map((section, sectionIdx) => {
              const sectionMetrics = computedMetrics.filter(
                (m) => m.section === section
              )
              const isCollapsed = collapsedSections.has(section)
              const isLast = sectionIdx === sections.length - 1

              return (
                <div key={section}>
                  {/* Section header row */}
                  <div
                    className={`flex items-center justify-between px-4 py-2 bg-muted/40 cursor-pointer select-none hover:bg-muted/60 transition-colors ${!isLast || !isCollapsed ? "border-b" : ""}`}
                    onClick={() => toggleCollapse(section)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                          !isCollapsed ? "rotate-90" : ""
                        }`}
                      />
                      <span className="text-[13px] font-semibold">{section}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {sectionMetrics.length}
                      </span>
                    </div>
                  </div>

                  {/* Metric rows */}
                  {!isCollapsed &&
                    sectionMetrics.map((metric, idx) => {
                      const isLastMetric = idx === sectionMetrics.length - 1
                      return (
                        <div
                          key={metric.key}
                          className={`flex items-center justify-between px-4 py-1.5 text-[13px] hover:bg-muted/20 transition-colors ${
                            !isLastMetric || !isLast ? "border-b border-border/50" : ""
                          }`}
                        >
                          <span className="text-foreground/80 pl-5">
                            {metric.label}
                          </span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {metric.value}
                          </span>
                        </div>
                      )
                    })}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* Edit Dialog */}
      <AccountFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        account={account}
        onSuccess={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />

      {/* Delete Dialog */}
      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        account={account}
        onSuccess={() => {
          setDeleteOpen(false)
          router.push("/")
          router.refresh()
        }}
      />
    </div>
  )
}
