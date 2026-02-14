"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: {
    id: string
    client_name: string
  } | null
  onSuccess: () => void
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSuccess,
}: AccountFormDialogProps) {
  const isEditing = !!account
  const [clientName, setClientName] = useState(account?.client_name || "")
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing ? `/api/accounts/${account.id}` : "/api/accounts"
      const method = isEditing ? "PATCH" : "POST"

      const body: Record<string, string> = {}
      if (clientName.trim()) body.client_name = clientName.trim()
      if (apiKey.trim()) body.api_key = apiKey.trim()

      if (!isEditing && (!body.client_name || !body.api_key)) {
        toast.error("Client name and API key are required")
        setLoading(false)
        return
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Something went wrong")
      }

      toast.success(isEditing ? "Account updated" : "Account created")
      setClientName("")
      setApiKey("")
      onSuccess()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit account" : "Add Klaviyo account"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the account details below."
              : "Connect a Klaviyo account to generate audit reports."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client name</Label>
            <Input
              id="clientName"
              placeholder="e.g. Acme Corp"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required={!isEditing}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              Klaviyo Private API Key
              {isEditing && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  (leave blank to keep current)
                </span>
              )}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={
                isEditing ? "••••••••" : "pk_xxxxxxxxxxxxxxxxxxxx"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required={!isEditing}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Your key is encrypted before being stored.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
