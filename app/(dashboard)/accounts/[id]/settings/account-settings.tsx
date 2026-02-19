"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, X, Check, ChevronsUpDown, Trash2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { FLOW_CATEGORIES, DEFAULT_FLOW_MAPPINGS, FLOW_AUTO_KEYWORDS } from "@/lib/constants"
import type {
  FlowCategory,
  FlowMappingEntry,
  FlowMappings,
} from "@/types/custom-config.types"

type KlaviyoAccount = {
  id: string
  client_name: string
  api_key_encrypted: string
  created_at: string | null
  last_audit_at: string | null
  last_used_at: string | null
  updated_at: string | null
  flow_mappings: FlowMappings | null
  timezone?: string | null
}

interface SimpleFlow {
  id: string
  name: string
  status: string
}

export function AccountSettings({ account }: { account: KlaviyoAccount }) {
  const timezoneOptions = typeof Intl !== "undefined" && "supportedValuesOf" in Intl
    ? (Intl.supportedValuesOf("timeZone") as string[])
    : ["UTC"]
  const allTimezoneOptions = ["UTC", ...timezoneOptions.filter((tz) => tz !== "UTC")]
  const [timezone, setTimezone] = useState<string>(account.timezone || "UTC")
  const [flowMappings, setFlowMappings] = useState<FlowMappings>(
    (account.flow_mappings as FlowMappings) ?? { ...DEFAULT_FLOW_MAPPINGS }
  )
  const [allFlows, setAllFlows] = useState<SimpleFlow[]>([])
  const [loadingFlows, setLoadingFlows] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openPopover, setOpenPopover] = useState<FlowCategory | null>(null)
  const [timezonePopoverOpen, setTimezonePopoverOpen] = useState(false)

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false)
  const initialSettings = useRef(
    JSON.stringify(
      {
        flow_mappings: (account.flow_mappings as FlowMappings) ?? DEFAULT_FLOW_MAPPINGS,
        timezone: account.timezone || "UTC",
      }
    )
  )

  // Fetch flows from Klaviyo for autocomplete
  useEffect(() => {
    async function loadFlows() {
      try {
        const res = await fetch(`/api/accounts/${account.id}/flows`)
        if (res.ok) {
          const data: SimpleFlow[] = await res.json()
          setAllFlows(data)
        } else {
          toast.error("Failed to load Klaviyo flows")
        }
      } catch {
        toast.error("Failed to load Klaviyo flows")
      } finally {
        setLoadingFlows(false)
      }
    }
    loadFlows()
  }, [account.id])

  // Track changes
  useEffect(() => {
    setHasChanges(
      JSON.stringify({
        flow_mappings: flowMappings,
        timezone,
      }) !== initialSettings.current
    )
  }, [flowMappings, timezone])

  const handleAddFlow = (category: FlowCategory, flow: SimpleFlow) => {
    setFlowMappings((prev) => {
      const existing = prev[category] ?? []
      if (existing.some((e) => e.flow_id === flow.id)) return prev
      return {
        ...prev,
        [category]: [
          ...existing,
          { flow_id: flow.id, flow_name: flow.name },
        ],
      }
    })
    // Don't close the popover — let the user keep adding
  }

  const handleRemoveFlow = (category: FlowCategory, flowId: string) => {
    setFlowMappings((prev) => ({
      ...prev,
      [category]: (prev[category] ?? []).filter(
        (e) => e.flow_id !== flowId
      ),
    }))
  }

  const handleClearCategory = (category: FlowCategory) => {
    setFlowMappings((prev) => ({
      ...prev,
      [category]: [],
    }))
  }

  const handleAutoAddFlows = () => {
    setFlowMappings(() => {
      const newMappings: FlowMappings = { ...DEFAULT_FLOW_MAPPINGS }
      const usedIds = new Set<string>()

      for (const cat of FLOW_CATEGORIES) {
        const keywords = FLOW_AUTO_KEYWORDS[cat.key]
        const matched: FlowMappingEntry[] = []

        for (const flow of allFlows) {
          if (usedIds.has(flow.id)) continue
          const nameLower = flow.name.toLowerCase()
          const isMatch = keywords.some((kw) => nameLower.includes(kw))
          if (isMatch) {
            matched.push({ flow_id: flow.id, flow_name: flow.name })
            usedIds.add(flow.id)
          }
        }

        newMappings[cat.key] = matched
      }

      const totalMatched = Object.values(newMappings).reduce(
        (sum, entries) => sum + entries.length,
        0
      )
      if (totalMatched > 0) {
        toast.success(`Auto-matched ${totalMatched} flow${totalMatched > 1 ? "s" : ""} across categories`)
      } else {
        toast.info("No flows matched the auto-detect keywords")
      }

      return newMappings
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flow_mappings: flowMappings,
          timezone,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save settings")
      }
      toast.success("Settings saved successfully")
      initialSettings.current = JSON.stringify({
        flow_mappings: flowMappings,
        timezone,
      })
      setHasChanges(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Flows already mapped to ANY category
  const allMappedFlowIds = new Set(
    Object.values(flowMappings).flatMap((entries: FlowMappingEntry[]) =>
      entries.map((e) => e.flow_id)
    )
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/accounts/${account.id}`}>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              {account.client_name}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Flow Mappings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timezone</CardTitle>
          <p className="text-sm text-muted-foreground">
            This timezone will be used for audit API aggregations. If no timezone
            is set, UTC is used by default.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Popover
              open={timezonePopoverOpen}
              onOpenChange={setTimezonePopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={timezonePopoverOpen}
                  className="h-10 w-full justify-between px-3 font-normal"
                >
                  <span className="truncate text-left">{timezone}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[420px] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput placeholder="Search timezone..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No timezone found.</CommandEmpty>
                    <CommandGroup>
                      {allTimezoneOptions.map((tz) => (
                        <CommandItem
                          key={tz}
                          value={tz}
                          onSelect={(selected) => {
                            const matched = allTimezoneOptions.find(
                              (option) => option.toLowerCase() === selected.toLowerCase()
                            )
                            if (matched) setTimezone(matched)
                            setTimezonePopoverOpen(false)
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              timezone === tz ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <span>{tz}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Flow Mappings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Flow Mappings</CardTitle>
            <Button
              variant="outline"
              className="h-9 text-sm px-4"
              onClick={handleAutoAddFlows}
              disabled={loadingFlows || allFlows.length === 0}
            >
              <Wand2 className="h-4 w-4 mr-1.5" />
              Auto Add Flows
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Map your Klaviyo flows to audit metric categories. Each category
            uses its mapped flows to calculate open rates, click rates, and
            revenue metrics.
          </p>
        </CardHeader>
        <CardContent className="space-y-0">
          {loadingFlows ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading flows from Klaviyo...
              </span>
            </div>
          ) : (
            FLOW_CATEGORIES.map((cat, idx) => {
              const entries = flowMappings[cat.key] ?? []

              // Hide already-mapped flows from the dropdown entirely
              const selectableFlows = allFlows.filter(
                (f) => !allMappedFlowIds.has(f.id)
              )

              return (
                <div key={cat.key}>
                  {idx > 0 && <Separator className="my-5" />}
                  <div className="space-y-3">
                    {/* Category header with add flow + clear all */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">
                            {cat.label}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cat.description}
                          </p>
                        </div>
                        <Popover
                          open={openPopover === cat.key}
                          onOpenChange={(open) =>
                            setOpenPopover(open ? cat.key : null)
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 text-sm px-4"
                            >
                              <ChevronsUpDown className="h-4 w-4 mr-1.5" />
                              Add flow
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[480px] p-0 bg-white"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <Command>
                              <CommandInput placeholder="Search flows..." />
                              <CommandList className="max-h-72">
                                <CommandEmpty className="py-8 text-sm">
                                  No matching flows found.
                                </CommandEmpty>
                                <CommandGroup>
                                  {selectableFlows.map((flow) => (
                                    <CommandItem
                                      key={flow.id}
                                      value={flow.name}
                                      onSelect={() =>
                                        handleAddFlow(cat.key, flow)
                                      }
                                      className="py-2.5 px-3"
                                    >
                                      <span className="flex-1">{flow.name}</span>
                                      <span
                                        className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                          flow.status === "live"
                                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                            : flow.status === "draft"
                                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                              : "bg-gray-100 text-gray-600 ring-1 ring-gray-500/20"
                                        }`}
                                      >
                                        {flow.status}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {entries.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                          onClick={() => handleClearCategory(cat.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Clear all
                        </Button>
                      )}
                    </div>

                    {/* Mapped flows as badges */}
                    {entries.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entries.map((entry) => (
                          <span
                            key={entry.flow_id}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-gray-50"
                          >
                            {entry.flow_name}
                            <button
                              onClick={() =>
                                handleRemoveFlow(cat.key, entry.flow_id)
                              }
                              className="rounded-md p-0.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 cursor-pointer transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
