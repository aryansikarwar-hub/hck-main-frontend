"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./Sidebar";
import { useSession } from "@/hooks/use-vigileye-data";

export function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  // The menu was rendered with no props at all, so it always read "Signed in"
  // with no account and no role — on an app where the role decides what you
  // are allowed to do.
  const { data: session } = useSession();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/30 bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {/* Was a button with no handler. There is exactly one place
            notifications live, so send the user there rather than leave a
            control that does nothing when pressed. */}
        <Link
          href="/alerts"
          aria-label="Alert inbox"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Bell className="h-5 w-5" />
        </Link>
        <UserMenu email={session?.email} role={session?.role} />
      </div>
    </header>
  );
}
