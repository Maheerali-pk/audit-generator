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
  History,
  Download,
} from "lucide-react"
import XLSX from "xlsx-js-style"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
  const [allAudits, setAllAudits] = useState<AuditReportRow[]>([])
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  const auditReport = allAudits.find((a) => a.id === selectedAuditId) ?? null

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Load all audit reports on mount
  useEffect(() => {
    async function loadAuditHistory() {
      try {
        const res = await fetch(`/api/accounts/${account.id}/audit?history=true`)
        if (res.ok) {
          const data: AuditReportRow[] = await res.json()
          if (data && data.length > 0) {
            setAllAudits(data)
            setSelectedAuditId(data[0].id)
          }
        }
      } catch {
        // Silently ignore
      } finally {
        setLoadingExisting(false)
      }
    }
    loadAuditHistory()
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

      const data: AuditReportRow = await res.json()
      setAllAudits((prev) => [data, ...prev])
      setSelectedAuditId(data.id)
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

  // Delete all audits
  const [deleteAuditsOpen, setDeleteAuditsOpen] = useState(false)
  const [deletingAudits, setDeletingAudits] = useState(false)

  const handleDeleteAllAudits = async () => {
    setDeletingAudits(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}/audit`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete audits")
      }
      setAllAudits([])
      setSelectedAuditId(null)
      setDeleteAuditsOpen(false)
      toast.success("All audit reports deleted")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setDeletingAudits(false)
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

  const handleExportExcel = () => {
    if (!auditReport || computedMetrics.length === 0) return

    // ── Color palette ──
    const brand    = "0D0D0D"
    const brandBg  = "111111"
    const subtBg   = "1C1C1C"
    const accent   = "4F46E5"
    const secBg    = "EEF2FF"
    const secText  = "3730A3"
    const colHdBg  = "F9FAFB"
    const colHdTxt = "6B7280"
    const valText  = "111827"
    const lblText  = "4B5563"
    const white    = "FFFFFF"
    const rowAlt   = "F9FAFB"
    const bdr      = "E5E7EB"
    const summBg   = "F0FDF4"
    const summBdr  = "BBF7D0"
    const summTxt  = "166534"

    type BorderStyle = "thin" | "medium"
    const border = (style: BorderStyle = "thin") => ({
      top:    { style, color: { rgb: bdr } },
      bottom: { style, color: { rgb: bdr } },
      left:   { style, color: { rgb: bdr } },
      right:  { style, color: { rgb: bdr } },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type CellStyle = any

    const data: (string | number | null)[][] = []
    const merges: XLSX.Range[] = []
    const rowStyles: Map<number, { cols: Map<number, CellStyle> }> = new Map()
    const rowHeights: Map<number, number> = new Map()

    const setStyle = (r: number, c: number, s: CellStyle) => {
      if (!rowStyles.has(r)) rowStyles.set(r, { cols: new Map() })
      rowStyles.get(r)!.cols.set(c, s)
    }
    const setRowHeight = (r: number, h: number) => rowHeights.set(r, h)
    const numCols = 6
    const L = 1 // left margin offset — col 0 is blank

    const emptyRow = () => new Array(numCols).fill(null)
    const fullMerge = (r: number) => merges.push({ s: { r, c: L }, e: { r, c: numCols - 2 } })

    // ── HEADER BLOCK ──
    const auditDate = auditReport.created_at ? formatDate(auditReport.created_at) : "—"
    const runtimeStr = auditReport.runtime_seconds ? `Runtime: ${auditReport.runtime_seconds}s` : ""

    // Row 0 — top spacer
    let r = 0
    data.push(emptyRow())
    setRowHeight(r, 8)

    // Row 1 — brand name (large, clean)
    r = 1
    data.push(emptyRow())
    fullMerge(r)
    setRowHeight(r, 44)
    for (let c = L; c < numCols - 1; c++) {
      setStyle(r, c, {
        font: { bold: true, sz: 26, color: { rgb: brand }, name: "Calibri" },
        fill: { fgColor: { rgb: white } },
        alignment: { vertical: "center", horizontal: "center" },
      })
    }
    // Put actual value in the merge start cell
    data[r][L] = account.client_name

    // Row 2 — report type label
    r = 2
    data.push(emptyRow())
    fullMerge(r)
    setRowHeight(r, 24)
    data[r][L] = "Email Marketing Audit"
    for (let c = L; c < numCols - 1; c++) {
      setStyle(r, c, {
        font: { sz: 12, color: { rgb: accent }, name: "Calibri" },
        fill: { fgColor: { rgb: white } },
        alignment: { vertical: "center", horizontal: "center" },
      })
    }

    // Row 3 — accent divider
    r = 3
    data.push(emptyRow())
    merges.push({ s: { r, c: L }, e: { r, c: numCols - 2 } })
    setRowHeight(r, 3)
    for (let c = L; c < numCols - 1; c++) {
      setStyle(r, c, { fill: { fgColor: { rgb: accent } } })
    }

    // Row 4 — info row: date left, runtime right
    r = 4
    data.push(emptyRow())
    merges.push({ s: { r, c: L }, e: { r, c: 3 } })
    data[r][L] = `Date: ${auditDate}`
    data[r][numCols - 2] = runtimeStr
    setRowHeight(r, 24)
    for (let c = L; c <= 3; c++) {
      setStyle(r, c, {
        font: { sz: 9, color: { rgb: "6B7280" }, name: "Calibri" },
        fill: { fgColor: { rgb: "F9FAFB" } },
        alignment: { vertical: "center", horizontal: "center" },
        border: { bottom: { style: "thin" as const, color: { rgb: bdr } } },
      })
    }
    setStyle(r, numCols - 2, {
      font: { sz: 9, color: { rgb: "6B7280" }, name: "Calibri" },
      fill: { fgColor: { rgb: "F9FAFB" } },
      alignment: { vertical: "center", horizontal: "right" },
      border: { bottom: { style: "thin" as const, color: { rgb: bdr } } },
    })

    // Row 5 — blank spacer
    r = 5
    data.push(emptyRow())
    setRowHeight(r, 10)

    // ── SUMMARY BAR ──
    r = 6
    const totalMetrics = computedMetrics.length
    const totalSections = sections.length
    data.push(emptyRow())
    fullMerge(r)
    data[r][L] = `${totalSections} Sections  ·  ${totalMetrics} Metrics`
    setRowHeight(r, 30)
    for (let c = L; c < numCols - 1; c++) {
      setStyle(r, c, {
        font: { bold: true, sz: 11, color: { rgb: summTxt }, name: "Calibri" },
        fill: { fgColor: { rgb: summBg } },
        border: {
          top:    { style: "thin" as const, color: { rgb: summBdr } },
          bottom: { style: "thin" as const, color: { rgb: summBdr } },
          left:   { style: "thin" as const, color: { rgb: summBdr } },
          right:  { style: "thin" as const, color: { rgb: summBdr } },
        },
        alignment: { vertical: "center", horizontal: "center" },
      })
    }

    // Row 7 — blank spacer
    r = 7
    data.push(emptyRow())
    setRowHeight(r, 8)

    // ── SECTIONS ──
    sections.forEach((section, sectionIdx) => {
      const sectionMetrics = computedMetrics.filter((m) => m.section === section)
      const sectionNum = String(sectionIdx + 1).padStart(2, "0")

      // Section header row
      r = data.length
      data.push(emptyRow())
      merges.push({ s: { r, c: L }, e: { r, c: numCols - 3 } })
      data[r][L] = `${sectionNum}   ${section.toUpperCase()}`
      data[r][numCols - 2] = `${sectionMetrics.length} metrics`
      setRowHeight(r, 34)
      for (let c = L; c <= numCols - 3; c++) {
        setStyle(r, c, {
          font: { bold: true, sz: 12, color: { rgb: secText }, name: "Calibri" },
          fill: { fgColor: { rgb: secBg } },
          border: border("medium"),
          alignment: { vertical: "center", horizontal: "center" },
        })
      }
      setStyle(r, numCols - 2, {
        font: { sz: 9, italic: true, color: { rgb: "9CA3AF" }, name: "Calibri" },
        fill: { fgColor: { rgb: secBg } },
        border: border("medium"),
        alignment: { vertical: "center", horizontal: "right" },
      })

      // Column sub-headers
      r = data.length
      data.push(emptyRow())
      data[r][L] = "#"
      data[r][L + 1] = "Metric"
      data[r][numCols - 2] = "Value"
      merges.push({ s: { r, c: L + 1 }, e: { r, c: numCols - 3 } })
      setRowHeight(r, 24)
      const colHdrStyle = (align: "left" | "center" | "right" = "left") => ({
        font: { bold: true, sz: 10, color: { rgb: colHdTxt }, name: "Calibri" },
        fill: { fgColor: { rgb: colHdBg } },
        border: border(),
        alignment: { vertical: "center" as const, horizontal: align },
      })
      setStyle(r, L, colHdrStyle("center"))
      setStyle(r, L + 1, colHdrStyle("center"))
      for (let c = L + 2; c <= numCols - 3; c++) setStyle(r, c, colHdrStyle("center"))
      setStyle(r, numCols - 2, colHdrStyle("center"))

      // Metric rows
      sectionMetrics.forEach((metric, idx) => {
        r = data.length
        const isOdd = idx % 2 === 1
        const bg = isOdd ? rowAlt : white
        data.push(emptyRow())
        data[r][L] = idx + 1
        data[r][L + 1] = metric.label
        data[r][numCols - 2] = metric.value
        merges.push({ s: { r, c: L + 1 }, e: { r, c: numCols - 3 } })
        setRowHeight(r, 28)

        setStyle(r, L, {
          font: { sz: 10, color: { rgb: "9CA3AF" }, name: "Calibri" },
          fill: { fgColor: { rgb: bg } },
          border: border(),
          alignment: { vertical: "center", horizontal: "center" },
        })
        setStyle(r, L + 1, {
          font: { sz: 12, color: { rgb: lblText }, name: "Calibri" },
          fill: { fgColor: { rgb: bg } },
          border: border(),
          alignment: { vertical: "center", horizontal: "left" },
        })
        for (let c = L + 2; c <= numCols - 3; c++) {
          setStyle(r, c, {
            fill: { fgColor: { rgb: bg } },
            border: border(),
          })
        }
        setStyle(r, numCols - 2, {
          font: { bold: true, sz: 12, color: { rgb: valText }, name: "Calibri" },
          fill: { fgColor: { rgb: bg } },
          border: border(),
          alignment: { vertical: "center", horizontal: "center" },
        })
      })

      // Spacer between sections
      if (sectionIdx < sections.length - 1) {
        r = data.length
        data.push(emptyRow())
        setRowHeight(r, 10)
      }
    })

    // ── FOOTER ──
    r = data.length
    data.push(emptyRow())
    setRowHeight(r, 6)
    r = data.length
    data.push(emptyRow())
    fullMerge(r)
    data[r][L] = "Generated by Klaviyo Audit Builder"
    setRowHeight(r, 18)
    for (let c = L; c < numCols - 1; c++) {
      setStyle(r, c, {
        font: { italic: true, sz: 8, color: { rgb: "9CA3AF" }, name: "Calibri" },
        alignment: { vertical: "center", horizontal: "center" },
      })
    }

    // ── Build worksheet ──
    const ws = XLSX.utils.aoa_to_sheet(data)

    ws["!cols"] = [
      { wch: 3 },   // col A — left margin
      { wch: 6 },   // col B — #
      { wch: 28 },  // col C — Metric (start)
      { wch: 14 },  // col D — Metric (merged)
      { wch: 22 },  // col E — Value
      { wch: 3 },   // col F — right margin
    ]

    ws["!merges"] = merges

    ws["!rows"] = []
    for (const [rowIdx, height] of rowHeights.entries()) {
      ws["!rows"][rowIdx] = { hpt: height }
    }

    // Apply styles
    for (const [rowIdx, rowData] of rowStyles.entries()) {
      for (const [colIdx, style] of rowData.cols.entries()) {
        const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
        if (!ws[addr]) ws[addr] = { v: "", t: "s" }
        ws[addr].s = style
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Audit Report")

    const dateStr = auditReport.created_at
      ? new Date(auditReport.created_at).toISOString().split("T")[0]
      : "export"
    const filename = `${account.client_name.replace(/[^a-zA-Z0-9]/g, "_")}_audit_${dateStr}.xlsx`

    XLSX.writeFile(wb, filename)
  }

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
        {allAudits.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs px-3 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDeleteAuditsOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Clear Audits
          </Button>
        )}
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
            {/* Table header row with audit selector */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                {allAudits.length > 1 ? (
                  <Select
                    value={selectedAuditId ?? undefined}
                    onValueChange={(val) => setSelectedAuditId(val)}
                  >
                    <SelectTrigger className="h-7 w-auto gap-1.5 border-none bg-transparent px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {allAudits.map((audit, idx) => (
                        <SelectItem key={audit.id} value={audit.id} className="text-xs">
                          {formatDate(audit.created_at)}
                          {idx === 0 && " (Latest)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {formatDate(auditReport.created_at)}
                  </span>
                )}
              </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[11px] px-2"
                  onClick={handleExportExcel}
                >
                  <Download className="h-3 w-3" />
                  Export
                </Button>
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

      {/* Delete All Audits Confirmation Dialog */}
      <Dialog open={deleteAuditsOpen} onOpenChange={setDeleteAuditsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete All Audits</DialogTitle>
            <DialogDescription>
              This will permanently delete all {allAudits.length} audit report{allAudits.length !== 1 ? "s" : ""} for this account. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteAuditsOpen(false)}
              disabled={deletingAudits}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAllAudits}
              disabled={deletingAudits}
            >
              {deletingAudits ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                "Delete All"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
