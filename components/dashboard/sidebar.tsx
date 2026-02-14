"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AccountFormDialog } from "./account-form-dialog"
import { DeleteAccountDialog } from "./delete-account-dialog"
import { cn } from "@/lib/utils"

type KlaviyoAccount = {
  id: string
  client_name: string
  api_key_encrypted: string
  created_at: string | null
  last_audit_at: string | null
  last_used_at: string | null
  updated_at: string | null
}

interface SidebarProps {
  accounts: KlaviyoAccount[]
}

export function Sidebar({ accounts }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<KlaviyoAccount | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<KlaviyoAccount | null>(
    null
  )

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </div>
        <span className="font-semibold tracking-tight">Audit Builder</span>
      </div>

      {/* Accounts Section Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Accounts
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCreateOpen(true)}
          title="Add account"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Account List */}
      <ScrollArea className="flex-1 px-2">
        {accounts.length === 0 ? (
          <div className="px-2 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No accounts yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Add a Klaviyo account to get started
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add account
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5 pb-4">
            {accounts.map((account) => {
              const isActive = pathname === `/accounts/${account.id}`
              return (
                <div
                  key={account.id}
                  className={cn(
                    "group flex items-center rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Link
                    href={`/accounts/${account.id}`}
                    className="flex flex-1 items-center gap-2.5 px-2.5 py-2 min-w-0"
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{account.client_name}</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="mr-1 opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" sideOffset={8}>
                      <DropdownMenuItem onClick={() => setEditAccount(account)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteAccount(account)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Create Dialog */}
      <AccountFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          setCreateOpen(false)
          router.refresh()
        }}
      />

      {/* Edit Dialog */}
      {editAccount && (
        <AccountFormDialog
          key={editAccount.id}
          open={!!editAccount}
          onOpenChange={(open) => !open && setEditAccount(null)}
          account={editAccount}
          onSuccess={() => {
            setEditAccount(null)
            router.refresh()
          }}
        />
      )}

      {/* Delete Dialog */}
      {deleteAccount && (
        <DeleteAccountDialog
          key={deleteAccount.id}
          open={!!deleteAccount}
          onOpenChange={(open) => !open && setDeleteAccount(null)}
          account={deleteAccount}
          onSuccess={() => {
            const wasOnDeletedPage =
              pathname === `/accounts/${deleteAccount.id}`
            setDeleteAccount(null)
            if (wasOnDeletedPage) {
              router.push("/")
            }
            router.refresh()
          }}
        />
      )}
    </aside>
  )
}
