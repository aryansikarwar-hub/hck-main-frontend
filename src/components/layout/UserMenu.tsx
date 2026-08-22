"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Loader2, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UserMenu({ email, role }: { email?: string; role?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Signing out is a client-side navigation, so nothing evicts the
      // TanStack cache on its own: without this the next person to sign in on
      // the same tab is served the previous account's session, structures and
      // alerts until each key goes stale.
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <UserCircle className="h-6 w-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          <DropdownMenuLabel>{email ?? "Signed in"}</DropdownMenuLabel>
          {role && (
            <p className="px-2 pb-1.5 text-xs capitalize text-muted-foreground">
              {role} · role decides what you can change
            </p>
          )}
          <DropdownMenuSeparator />
          {/* A "Settings" item used to sit here pointing at /settings, which
              has never existed — it 404'd every time. Roles, the only
              per-account setting there is, live on /admin. */}
          <DropdownMenuItem onClick={() => router.push("/admin")}>Admin console</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmOpen(true)}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation before signing out — a misclick in the field shouldn't
          drop an inspector's session mid-inspection. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You&apos;ll need to sign in again to view structures and alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={signingOut}>
              Cancel
            </Button>
            <Button onClick={handleLogout} disabled={signingOut}>
              {signingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
