"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Calendar,
  Clock,
  Key,
  Pencil,
  Trash2,
  FileText,
  Building2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

  const maskedKey = `••••••••${account.api_key_encrypted.slice(-8)}`

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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {account.client_name}
            </h1>
            <p className="text-sm text-muted-foreground">Klaviyo Account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  API Key
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-mono truncate">{maskedKey}</p>
                  <Badge variant="secondary" className="shrink-0">
                    Encrypted
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {formatDate(account.created_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Last Audit
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {formatDate(account.last_audit_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Last Used
                </p>
                <p className="text-sm font-medium mt-0.5">
                  {formatDate(account.last_used_at)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Audit Section */}
      <Separator />
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Generate Audit Report</h2>

        {/* Section Checkboxes */}
        <div className="flex flex-wrap gap-4">
          {AUDIT_SECTIONS.map((section) => (
            <label
              key={section.id}
              className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-[240px]"
            >
              <Checkbox
                checked={selectedSections.includes(section.id)}
                onCheckedChange={() => toggleSection(section.id)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium leading-none">
                  {section.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {section.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        <Button
          size="lg"
          className="gap-2"
          onClick={handleGenerateAudit}
          disabled={auditLoading || selectedSections.length === 0}
        >
          {auditLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating audit...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4" />
              Generate Audit Report
            </>
          )}
        </Button>
      </div>

      {/* Audit Error */}
      {auditError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {auditError}
        </div>
      )}

      {/* Audit Results */}
      {loadingExisting ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading previous audit...
        </div>
      ) : auditReport && computedMetrics.length > 0 ? (
        <div className="space-y-4">
          <Separator />

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Audit Results</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {auditReport.runtime_seconds && (
                <span>Completed in {auditReport.runtime_seconds}s</span>
              )}
              <Badge
                variant={
                  auditReport.status === "completed"
                    ? "secondary"
                    : "destructive"
                }
              >
                {auditReport.status}
              </Badge>
            </div>
          </div>

          {/* Metrics Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Metric</TableHead>
                    <TableHead className="w-[25%]">Section</TableHead>
                    <TableHead className="w-[25%] text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedMetrics.map((metric) => (
                    <TableRow key={metric.key}>
                      <TableCell className="font-medium">
                        {metric.label}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {metric.section}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {metric.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
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
